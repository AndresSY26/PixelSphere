import fs from 'node:fs/promises';
import nodeFs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { saveMediaMetadata } from '../services/storageService.js';
import { broadcastNeuralEvent } from '../services/eventService.js';
import { UPLOADS_DIR } from '../config/constants.js';
import { uploadToCloudStorage } from '../services/cloudStorageService.js';
import { optimizeVideoToWebM, encryptFileZeroKnowledge, encryptZeroKnowledge } from '../services/mediaOptimizationService.js';

/**
 * Obtiene el stream de descarga de Google Drive gestionando redirecciones HTTP 302/303,
 * preservando la cabecera Authorization y reintentando con export en archivos de Google Docs.
 */
async function fetchDriveMediaStream(fileId, token, isExport = false) {
  let driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;
  if (isExport) {
    driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
  }

  let driveRes = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Interceptar redirección para preservar cabecera Authorization en saltos de dominio
      driveRes = await fetch(driveUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        redirect: 'manual'
      });

      // Seguir redirección 301, 302, 303, 307, 308 conservando el token
      if ([301, 302, 303, 307, 308].includes(driveRes.status)) {
        const redirectUrl = driveRes.headers.get('location');
        if (redirectUrl) {
          driveRes = await fetch(redirectUrl, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        }
      }

      // Si devuelve 403 y no era export, puede ser un documento de Google Workspace que requiere files.export
      if (!driveRes.ok && driveRes.status === 403 && !isExport) {
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
        const exportRes = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (exportRes.ok) {
          return exportRes;
        }
      }

      if (driveRes.ok) {
        return driveRes;
      }

      // Reintentar si Google responde con 503 o 429
      if ([503, 502, 504, 429].includes(driveRes.status) && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      return driveRes;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }

  return driveRes;
}

export async function importFromCloud(req, res) {
  try {
    const { userId, externalUrl, filename, provider, mimeType } = req.body;

    if (!userId || !externalUrl) {
      return res.status(400).json({ error: 'Faltan datos de importación (userId o externalUrl).' });
    }

    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error(`Falla al descargar desde la nube (${response.statusText}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileId = Math.random().toString(36).substring(2, 11);
    const type = mimeType && mimeType.startsWith('video/') ? 'video' : 'image';

    const cleanFilename = (filename || 'imported_file').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const diskName = `${fileId}_cloud_${cleanFilename}`;
    const publicPath = `/uploads/${userId}/${type}/${diskName}`;

    // Cifrar con Zero-Knowledge y subir directamente a Firebase Storage
    const encrypted = encryptZeroKnowledge(buffer);
    const cloudStoragePath = `media/${userId}/${type}/${diskName}.enc`;
    let cloudUrl = null;
    try {
      const uploadRes = await uploadToCloudStorage(cloudStoragePath, encrypted);
      cloudUrl = uploadRes.downloadUrl;
    } catch (e) {
      console.warn('[CloudImport] Error subiendo a Firebase Storage:', e.message);
    }

    const newMedia = {
      id: fileId,
      userId,
      type,
      url: publicPath,
      path: publicPath,
      thumbnailUrl: publicPath,
      cloudStoragePath,
      cloudUrl,
      filename: `Cloud_${filename || 'file'}`,
      size: buffer.length,
      mimeType: mimeType || 'image/jpeg',
      tags: ['cloud-import', provider || 'external'],
      isPrivate: false,
      createdAt: new Date().toISOString(),
      metadata: {
        cameraSource: provider || 'cloud',
        cloudId: `ext_${fileId}`
      }
    };

    await saveMediaMetadata(newMedia);
    broadcastNeuralEvent('MEDIA', { action: 'CREATED', media: newMedia, userId });
    return res.status(201).json({ success: true, item: newMedia });
  } catch (error) {
    console.error('[CloudController] Error en importación individual:', error);
    return res.status(500).json({ error: 'Falla en la importación de medios.', details: error.message });
  }
}

/**
 * Ingesta directa servidor-a-servidor de lotes masivos de Google Drive.
 * Soporta desde 1 hasta 126+ videos o imágenes de cualquier peso y duración sin sobrecargar la memoria.
 */
export async function importDriveBatch(req, res) {
  try {
    const { userId, token, items } = req.body;

    if (!userId || !token || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Parámetros inválidos. Se requiere userId, token y array items.' });
    }

    console.log(`[DriveBatch] Iniciando ingesta masiva de ${items.length} activos para usuario ${userId}...`);

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const filename = item.name || `drive_media_${i}`;
      const isVideo = (item.mimeType && item.mimeType.startsWith('video/')) || /\.(mp4|mov|webm|mkv|avi|m4v|flv)$/i.test(filename);
      const isGoogleDoc = item.mimeType?.startsWith('application/vnd.google-apps.');
      const type = isVideo ? 'video' : 'image';

      try {
        console.log(`[DriveBatch] [${i + 1}/${items.length}] Transfiriendo a disco: ${filename} (ID: ${item.id})`);

        const driveRes = await fetchDriveMediaStream(item.id, token, isGoogleDoc);

        if (!driveRes.ok) {
          const errText = await driveRes.text().catch(() => '');
          throw new Error(`Google API status ${driveRes.status}: ${driveRes.statusText} ${errText}`);
        }

        const fileId = Math.random().toString(36).substring(2, 11);
        const userPath = path.join(UPLOADS_DIR, userId, type);
        await fs.mkdir(userPath, { recursive: true });

        const cleanFilename = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
        const baseClean = cleanFilename.replace(/\.[^/.]+$/, '');
        let diskName = `${fileId}_drive_${baseClean}.${isVideo ? 'webm' : 'webp'}`;
        let filePath = path.join(userPath, diskName);
        let publicPath = `/uploads/${userId}/${type}/${diskName}`;

        let cloudStoragePath = null;
        let cloudUrl = null;
        let finalThumbnailUrl = publicPath;
        let width = null;
        let height = null;
        let duration = null;
        let finalSize = 0;
        let finalMime = isVideo ? 'video/webm' : 'image/webp';

        const thumbDir = path.join(UPLOADS_DIR, userId, 'thumbnails');
        await fs.mkdir(thumbDir, { recursive: true });
        const thumbName = `thumb_${fileId}.webp`;
        const thumbDiskPath = path.join(thumbDir, thumbName);

        if (isVideo) {
          // 1. Descargar a archivo temporal bruto
          const rawTempPath = path.join(userPath, `temp_${fileId}_raw.mp4`);
          const fileStream = nodeFs.createWriteStream(rawTempPath);
          await pipeline(Readable.fromWeb(driveRes.body), fileStream);

          // 2. Transcodificar a WebM ultrarrápido con deducción sustancial de peso (40%-65%) y generar miniatura WebP
          console.log(`[DriveBatch] Transcodificando ${filename} a WebM con alta compresión...`);
          const opt = await optimizeVideoToWebM(rawTempPath, filePath, thumbDiskPath);
          await fs.unlink(rawTempPath).catch(() => {});
          finalSize = opt.size;
          width = opt.width;
          height = opt.height;
          duration = opt.duration;
          console.log(`[DriveBatch] Video transcodificado a WebM con éxito: ${opt.size} bytes (${opt.width}x${opt.height})`);

          finalThumbnailUrl = `/uploads/${userId}/thumbnails/${thumbName}`;
          if (nodeFs.existsSync(thumbDiskPath)) {
            const rawThumb = await fs.readFile(thumbDiskPath);
            const encThumb = encryptZeroKnowledge(rawThumb);
            await fs.writeFile(thumbDiskPath, encThumb);
            uploadToCloudStorage(`thumbnails/${userId}/${thumbName}.enc`, encThumb).catch((e) => {
              console.warn('[DriveBatch] Fallo subiendo miniatura a Firebase:', e.message);
            });
          }

          // 3. Cifrar archivo WebM con Zero-Knowledge y subir a Firebase Storage
          const encVideoPath = `${filePath}.enc`;
          try {
            console.log(`[DriveBatch] Cifrando WebM ${diskName} con AES-256-GCM Zero-Knowledge...`);
            await encryptFileZeroKnowledge(filePath, encVideoPath);
            cloudStoragePath = `media/${userId}/video/${diskName}.enc`;
            console.log(`[DriveBatch] Subiendo WebM cifrado (${opt.size} bytes) a Firebase Storage...`);
            const uploadRes = await uploadToCloudStorage(cloudStoragePath, encVideoPath);
            cloudUrl = uploadRes.downloadUrl;
            console.log(`[DriveBatch] WebM subido exitosamente a Firebase Storage! URL disponible.`);
            // Limpieza inmediata de archivos temporales en el servidor
            await fs.unlink(filePath).catch(() => {});
            await fs.unlink(encVideoPath).catch(() => {});
            await fs.unlink(thumbDiskPath).catch(() => {});
          } catch (upErr) {
            console.warn('[DriveBatch] Fallo al subir WebM a Firebase Storage:', upErr.message);
            await fs.unlink(filePath).catch(() => {});
            await fs.unlink(encVideoPath).catch(() => {});
            await fs.unlink(thumbDiskPath).catch(() => {});
          }
        } else {
          // Descargar imagen directamente a archivo temporal
          const rawImgPath = path.join(userPath, `temp_${fileId}_raw`);
          const fileStream = nodeFs.createWriteStream(rawImgPath);
          await pipeline(Readable.fromWeb(driveRes.body), fileStream);

          try {
            const imgBuffer = await fs.readFile(rawImgPath);
            const image = sharp(imgBuffer);
            const meta = await image.metadata();
            width = meta.width || null;
            height = meta.height || null;

            // Optimización a WebP de alta fidelidad
            const webpBuffer = await sharp(imgBuffer).webp({ quality: 82 }).toBuffer();
            finalSize = webpBuffer.length;
            const encrypted = encryptZeroKnowledge(webpBuffer);

            // Generar y subir miniatura WebP directamente
            const thumbBuffer = await sharp(webpBuffer).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
            const encThumb = encryptZeroKnowledge(thumbBuffer);
            uploadToCloudStorage(`thumbnails/${userId}/${thumbName}.enc`, encThumb).catch(() => {});
            finalThumbnailUrl = `/uploads/${userId}/thumbnails/${thumbName}`;

            // Subir a Firebase Storage
            cloudStoragePath = `media/${userId}/image/${diskName}.enc`;
            const uploadRes = await uploadToCloudStorage(cloudStoragePath, encrypted);
            cloudUrl = uploadRes.downloadUrl;

            // Limpieza inmediata de archivos temporales
            await fs.unlink(rawImgPath).catch(() => {});
            await fs.unlink(filePath).catch(() => {});
            await fs.unlink(thumbDiskPath).catch(() => {});
          } catch (imgErr) {
            console.warn('[DriveBatch] Fallo procesando imagen para Firebase Storage:', imgErr.message);
            await fs.unlink(rawImgPath).catch(() => {});
            await fs.unlink(filePath).catch(() => {});
            await fs.unlink(thumbDiskPath).catch(() => {});
          }
        }

        const newMedia = {
          id: fileId,
          userId,
          type,
          url: publicPath,
          path: publicPath,
          thumbnailUrl: finalThumbnailUrl,
          cloudStoragePath,
          cloudUrl,
          filename: `${baseClean}.${isVideo ? 'webm' : 'webp'}`,
          originalName: filename,
          size: finalSize,
          width,
          height,
          duration,
          mimeType: finalMime,
          tags: ['google-drive', 'cloud-import', type, isVideo ? 'webm' : 'webp'],
          isPrivate,
          isAdultContent,
          createdAt: new Date().toISOString(),
          metadata: {
            cameraSource: 'Google Drive',
            driveId: item.id,
            width,
            height,
            duration
          }
        };

        await saveMediaMetadata(newMedia);
        results.push(newMedia);

        // Notificar en tiempo real por el canal SSE
        broadcastNeuralEvent('MEDIA', { action: 'CREATED', media: newMedia, userId });
        console.log(`[DriveBatch] [${i + 1}/${items.length}] Ingestado exitosamente: ${filename} -> ${newMedia.filename} (${finalSize} bytes)`);
      } catch (itemErr) {
        console.error(`[DriveBatch] Error ingestado ${filename}:`, itemErr);
        errors.push({ id: item.id, name: filename, error: itemErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      total: items.length,
      importedCount: results.length,
      failedCount: errors.length,
      items: results,
      errors: errors
    });
  } catch (error) {
    console.error('[CloudController] Error general en importDriveBatch:', error);
    return res.status(500).json({ error: 'Falla al procesar lote de Drive', details: error.message });
  }
}

/**
 * Proxy de streaming continuo directo al cliente sin cargar buffers en memoria.
 */
export async function downloadDriveProxy(req, res) {
  try {
    const fileId = req.query.fileId || req.body?.fileId;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '') || req.query.token || req.body?.token;
    const isExport = req.query.export === 'true';

    if (!fileId || !token) {
      return res.status(400).json({ error: 'fileId y token son requeridos' });
    }

    const driveRes = await fetchDriveMediaStream(fileId, token, isExport);

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => '');
      let clientMsg = `Error de Google Drive (${driveRes.status}): ${driveRes.statusText}`;
      if (driveRes.status === 401) {
        clientMsg = 'Token de Google expirado. Por favor reconecta tu cuenta de Google.';
      } else if (driveRes.status === 403) {
        clientMsg = 'Sin permiso para acceder a este archivo en Google Drive.';
      } else if (driveRes.status === 404) {
        clientMsg = 'Archivo no encontrado en Google Drive.';
      }

      return res.status(driveRes.status).json({
        error: clientMsg,
        details: errText
      });
    }

    const contentType = driveRes.headers.get('content-type') || (isExport ? 'application/pdf' : 'application/octet-stream');
    const contentLength = driveRes.headers.get('content-length');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    const contentDisposition = driveRes.headers.get('content-disposition');
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Tubería directa al cliente sin crear Buffers en RAM
    return Readable.fromWeb(driveRes.body).pipe(res);
  } catch (error) {
    console.error('[CloudController] Error proxy Drive:', error);
    return res.status(500).json({ error: 'Falla al procesar descarga de Drive en el servidor', details: error.message });
  }
}
