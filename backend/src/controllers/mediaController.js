import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { 
  getMedia, 
  getMediaByUser, 
  getDeletedMedia,
  findMediaById, 
  saveMediaMetadata, 
  updateMedia as updateMediaStorage, 
  deleteMedia as deleteMediaStorage,
  deleteMultipleMedia,
  restoreMultipleMedia,
  emptyTrash,
  cleanupExpiredTrash,
  recordMediaView,
  updateVideoProgress,
  findUserById,
  unlockAchievement,
  checkUserStorageQuota,
  findMediaByHash
} from '../services/storageService.js';
import { UPLOADS_DIR } from '../config/constants.js';
import { autoTagImage } from '../services/geminiService.js';
import { 
  optimizeImageToWebP, 
  optimizeVideoToWebM, 
  encryptZeroKnowledge, 
  decryptZeroKnowledge, 
  encryptFileZeroKnowledge,
  decryptFileZeroKnowledge,
  isZeroKnowledgeEncrypted 
} from '../services/mediaOptimizationService.js';
import { 
  uploadToCloudStorage, 
  downloadFromCloudStorage, 
  downloadFromCloudStorageToFile, 
  deleteFromCloudStorage 
} from '../services/cloudStorageService.js';
import { broadcastNeuralEvent } from '../services/eventService.js';
import { primeMediaCache, getCachedMedia, setCachedMedia, deleteCachedMedia } from '../services/mediaCacheService.js';

const uploadThumbnailsMap = new Map();

let mediaListCache = {
  data: null,
  timestamp: 0,
};

export function invalidateMediaListCache() {
  mediaListCache.data = null;
  mediaListCache.timestamp = 0;
}

export async function listMedia(req, res) {
  try {
    const { userId, type, isDeleted, isPrivate, albumId, query, all } = req.query;
    
    let items;
    const filterUserId = (all === 'true' || userId === 'all' || !userId) ? null : userId;

    if (isDeleted === 'true') {
      // Activar comprobación de purga automática de papelera para elementos mayores a 30 días
      cleanupExpiredTrash(30).catch(() => {});
      items = await getDeletedMedia(filterUserId);
    } else {
      // Usar caché en memoria de 2 segundos para evitar queries repetidas a Neon DB al navegar
      const now = Date.now();
      if (!query && mediaListCache.data && (now - mediaListCache.timestamp < 2500)) {
        items = mediaListCache.data;
      } else {
        items = await getMedia({ isDeleted: false, userId: null });
        if (!query) {
          mediaListCache.data = items;
          mediaListCache.timestamp = now;
        }
      }
    }

    if (filterUserId && isDeleted !== 'true') {
      items = items.filter(m => m.userId === filterUserId);
    }

    if (isDeleted !== undefined) {
      const showDeleted = isDeleted === 'true';
      items = items.filter(m => !!m.isDeleted === showDeleted);
    } else {
      items = items.filter(m => !m.isDeleted);
    }

    if (type) {
      items = items.filter(m => m.type === type);
    }

    if (isPrivate !== undefined) {
      const showPrivate = isPrivate === 'true';
      items = items.filter(m => !!m.isPrivate === showPrivate);
    }

    if (albumId) {
      items = items.filter(m => m.albumId === albumId || (m.albumIds && m.albumIds.includes(albumId)));
    }

    if (query) {
      const q = query.toLowerCase();
      items = items.filter(m => 
        (m.filename && m.filename.toLowerCase().includes(q)) ||
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    return res.json(items);
  } catch (error) {
    console.error('[MediaController] Error al listar medios:', error);
    return res.status(500).json({ error: 'Error al listar medios.' });
  }
}

export async function getMediaById(req, res) {
  try {
    const { id } = req.params;
    const media = await findMediaById(id);
    if (!media) return res.status(404).json({ error: 'Medio no encontrado.' });
    return res.json(media);
  } catch (error) {
    console.error('[MediaController] Error al obtener medio:', error);
    return res.status(500).json({ error: 'Error al obtener medio.' });
  }
}

export async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo.' });
    }

    const { userId, title, isPrivate, latitude, longitude, albumId } = req.body;
    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/');
    const detectedType = isVideo ? 'video' : 'image';
    const cleanUserId = userId || 'anonymous';
    const mediaId = Math.random().toString(36).substring(2, 11);

    // 1. Verificación estricta de Cuota de Almacenamiento (Planes Free 2GB / Pro 50GB / Ultra 200GB)
    const quotaCheck = await checkUserStorageQuota(cleanUserId, file.size);
    if (!quotaCheck.allowed) {
      if (file.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      return res.status(403).json({
        error: `Has superado tu cuota de almacenamiento de ${Math.round(quotaCheck.quota / (1024 * 1024 * 1024))} GB. Mejora tu plan para continuar subiendo archivos.`,
        code: 'STORAGE_QUOTA_EXCEEDED',
        quota: quotaCheck.quota,
        used: quotaCheck.used,
        plan: quotaCheck.plan
      });
    }

    // 2. Deduplicación inteligente por SHA-256 (Cero almacenamiento duplicado)
    let incomingFileBuf = file.buffer;
    if (!incomingFileBuf && file.path && fs.existsSync(file.path)) {
      incomingFileBuf = await fs.promises.readFile(file.path).catch(() => null);
    }
    const fileHash = incomingFileBuf ? crypto.createHash('sha256').update(incomingFileBuf).digest('hex') : null;

    if (fileHash) {
      const existingMedia = await findMediaByHash(cleanUserId, fileHash);
      if (existingMedia) {
        console.log(`[UploadMedia] Deduplicación exitosa: archivo ya existe como ${existingMedia.filename} (Hash: ${fileHash})`);
        if (file.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path).catch(() => {});
        }
        return res.status(200).json(existingMedia);
      }
    }

    const userUploadPath = path.join(UPLOADS_DIR, cleanUserId, detectedType);
    await fs.promises.mkdir(userUploadPath, { recursive: true });

    const thumbDir = path.join(UPLOADS_DIR, cleanUserId, 'thumbnails');
    await fs.promises.mkdir(thumbDir, { recursive: true });
    const thumbName = `thumb_${mediaId}.webp`;
    const thumbDiskPath = path.join(thumbDir, thumbName);

    const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    let finalFilename = '';
    let publicPath = '';
    let finalThumbnailUrl = `/uploads/${cleanUserId}/thumbnails/${thumbName}`;
    let finalSize = file.size;
    let cleanMime = isVideo ? 'video/webm' : 'image/webp';
    let width = 1920;
    let height = 1080;

    let cloudStoragePath = '';
    let cloudUrl = '';
    let imageOptBuffer = null;

    if (!isVideo) {
      finalFilename = `${mediaId}_${baseName}.webp`;
      const finalDiskPath = path.join(userUploadPath, finalFilename);

      const opt = await optimizeImageToWebP(file.path || file.buffer);
      width = opt.width;
      height = opt.height;
      finalSize = opt.size;
      imageOptBuffer = opt.buffer;

      // Cifrado Zero-Knowledge (AES-256-GCM)
      const encrypted = encryptZeroKnowledge(opt.buffer);

      // Respaldo en Firebase Storage (en la nube) - ÚNICAMENTE en la carpeta media/ (Cero duplicación de espacio)
      cloudStoragePath = `media/${cleanUserId}/image/${finalFilename}.enc`;
      try {
        const cloudRes = await uploadToCloudStorage(cloudStoragePath, encrypted);
        cloudUrl = cloudRes.downloadUrl;
      } catch (err) {
        console.warn('[UploadMedia] Error subiendo a Firebase Storage:', err.message);
      }

      publicPath = `/uploads/${cleanUserId}/image/${finalFilename}`;
      // La imagen optimizada es su propia miniatura (ahorra 50% de espacio en Firebase Storage)
      finalThumbnailUrl = publicPath;

      // Limpieza de archivos temporales
      if (file.path) await fs.promises.unlink(file.path).catch(() => {});
      await fs.promises.unlink(finalDiskPath).catch(() => {});
    } else {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
      const cleanExt = (ext === '.webm' || ext === '.mov') ? ext : '.mp4';
      finalFilename = `${mediaId}_${baseName}${cleanExt}`;
      const finalDiskPath = path.join(userUploadPath, finalFilename);

      if (file.path && file.path !== finalDiskPath) {
        await fs.promises.copyFile(file.path, finalDiskPath);
      } else if (file.buffer) {
        await fs.promises.writeFile(finalDiskPath, file.buffer);
      }

      const encVideoPath = `${finalDiskPath}.enc`;
      cloudStoragePath = `media/${cleanUserId}/video/${finalFilename}.enc`;
      try {
        await encryptFileZeroKnowledge(finalDiskPath, encVideoPath);
        const cloudRes = await uploadToCloudStorage(cloudStoragePath, encVideoPath);
        cloudUrl = cloudRes.downloadUrl;
      } catch (err) {
        console.warn('[UploadMedia] Error subiendo video a Firebase Storage:', err.message);
      }

      publicPath = `/uploads/${cleanUserId}/video/${finalFilename}`;
      // Usar miniatura base64 directa o URL del video (cero archivos duplicados en Firebase Storage)
      finalThumbnailUrl = publicPath;

      // Limpieza inmediata de archivos temporales en el servidor
      if (file.path) await fs.promises.unlink(file.path).catch(() => {});
      await fs.promises.unlink(finalDiskPath).catch(() => {});
      await fs.promises.unlink(encVideoPath).catch(() => {});
    }

    const newMedia = {
      id: mediaId,
      userId: cleanUserId,
      type: detectedType,
      url: publicPath,
      path: publicPath,
      thumbnailUrl: finalThumbnailUrl,
      cloudStoragePath,
      cloudUrl,
      filename: `${baseName}.${isVideo ? 'mp4' : 'webp'}`,
      title: title || file.originalname,
      size: finalSize,
      fileHash: fileHash || undefined,
      mimeType: cleanMime,
      tags: [detectedType, 'upload', isVideo ? 'video' : 'webp'],
      isPrivate: isPrivate === 'true' || isPrivate === true,
      albumId: albumId || null,
      createdAt: new Date().toISOString(),
      metadata: {
        width,
        height,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined
      }
    };

    // Auto-etiquetado con Gemini en segundo plano (asíncrono, cero latencia en subida)
    if (!isVideo && imageOptBuffer) {
      const optBuf = imageOptBuffer;
      setTimeout(async () => {
        try {
          const dataUri = `data:image/webp;base64,${optBuf.toString('base64')}`;
          const aiResult = await autoTagImage(dataUri, [], '', file.originalname || finalFilename);
          if (aiResult?.tags?.length || aiResult?.description) {
            const updatedTags = Array.from(new Set([...newMedia.tags, ...(aiResult.tags || [])]));
            const { query } = await import('../db/index.js');
            await query('UPDATE media SET tags = $1, description = COALESCE($2, description) WHERE id = $3', [
              updatedTags,
              aiResult.description || null,
              mediaId
            ]);
          }
        } catch (aiErr) {}
      }, 50);
    }

    await saveMediaMetadata(newMedia);
    await unlockAchievement(cleanUserId, 'first_upload');

    return res.status(201).json({ success: true, media: newMedia });
  } catch (error) {
    console.error('[MediaController] Error en subida de medios:', error);
    return res.status(500).json({ error: 'Falla al procesar la subida.' });
  }
}

/**
 * INGESTA POR FRAGMENTOS (CHUNKED UPLOAD) RESILIENTE Y ATÓMICA
 */
export async function handleChunkedUpload(req, res) {
  try {
    const chunkFile = req.file || (req.files && (req.files[0] || req.files['chunk']?.[0] || req.files['file']?.[0]));

    const {
      userId,
      filename,
      fileId: reqFileId,
      chunkIndex: rawChunkIndex,
      totalChunks: rawTotalChunks,
      isAdult,
      filesize,
      contentType,
      lat,
      lng,
      cameraSource,
      thumbnailB64,
      albumId
    } = req.body;

    if (!userId || !filename || !chunkFile) {
      return res.status(400).json({ error: 'Faltan metadatos o fragmento de archivo.' });
    }

    const fileId = reqFileId || Math.random().toString(36).substring(2, 11);
    const chunkIndex = parseInt(rawChunkIndex ?? '0', 10);
    const totalChunks = parseInt(rawTotalChunks ?? '1', 10);
    const isAdultContent = isAdult === 'true' || isAdult === true;
    const totalSize = parseInt(filesize ?? '0', 10) || chunkFile.size;

    // 1. Verificación de cuota de almacenamiento en subida por fragmentos
    const quotaCheck = await checkUserStorageQuota(userId, totalSize);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: `Has superado tu cuota de almacenamiento de ${Math.round(quotaCheck.quota / (1024 * 1024 * 1024))} GB. Mejora tu plan para continuar subiendo archivos.`,
        code: 'STORAGE_QUOTA_EXCEEDED',
        quota: quotaCheck.quota,
        used: quotaCheck.used,
        plan: quotaCheck.plan
      });
    }

    const isVideoExt = /\.(mp4|mov|webm|mkv|avi|m4v|3gp|flv|wmv)$/i.test(filename);
    const isVideoMime = (contentType || chunkFile.mimetype || '').startsWith('video/');
    const detectedType = (isVideoMime || isVideoExt) ? 'video' : 'image';

    const userUploadPath = path.join(UPLOADS_DIR, userId, detectedType);
    await fs.promises.mkdir(userUploadPath, { recursive: true });

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const cleanFilename = `${fileId}_${safeName}`;
    const filePath = path.join(userUploadPath, cleanFilename);
    const publicPath = `/uploads/${userId}/${detectedType}/${cleanFilename}`;

    // Si viene thumbnailB64 en cualquier fragmento, almacenarlo de inmediato
    if (thumbnailB64) {
      try {
        const thumbDir = path.join(UPLOADS_DIR, userId, 'thumbnails');
        await fs.promises.mkdir(thumbDir, { recursive: true });
        const thumbName = `thumb_${fileId}.jpg`;
        const base64Data = thumbnailB64.includes(',') ? thumbnailB64.split(',')[1] : thumbnailB64;
        await fs.promises.writeFile(path.join(thumbDir, thumbName), Buffer.from(base64Data, 'base64'));
      } catch (thumbErr) {
        console.warn('[ChunkUpload] Error guardando thumbnail:', thumbErr.message);
      }
    }

    if (totalChunks <= 1) {
      // Subida de un único fragmento (fotos o videos cortos)
      await fs.promises.writeFile(filePath, chunkFile.buffer);
    } else {
      // Subida multifragmento: Guardar cada fragmento en su archivo temporal para garantizar orden estricto
      const tempChunksDir = path.join(userUploadPath, `.chunks_${fileId}`);
      await fs.promises.mkdir(tempChunksDir, { recursive: true });
      const chunkFilePath = path.join(tempChunksDir, `part_${chunkIndex}`);
      await fs.promises.writeFile(chunkFilePath, chunkFile.buffer);

      // Si es el último fragmento, ensamblar en orden numérico estricto
      if (chunkIndex >= totalChunks - 1) {
        for (let i = 0; i < totalChunks; i++) {
          const partFile = path.join(tempChunksDir, `part_${i}`);
          if (!fs.existsSync(partFile)) {
            return res.status(400).json({ error: `Fragmento ${i} no encontrado para ensamblaje.` });
          }
        }

        const writeStream = fs.createWriteStream(filePath);
        for (let i = 0; i < totalChunks; i++) {
          const partFile = path.join(tempChunksDir, `part_${i}`);
          const partBuffer = await fs.promises.readFile(partFile);
          if (!writeStream.write(partBuffer)) {
            await new Promise((resolve) => writeStream.once('drain', resolve));
          }
        }
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          writeStream.end();
        });

        // Limpiar el directorio temporal
        await fs.promises.rm(tempChunksDir, { recursive: true, force: true }).catch(() => {});
      } else {
        return res.status(200).json({ status: 'chunk_received', index: chunkIndex });
      }
    }

    // Deduplicación inteligente por hash SHA-256
    let chunkedFileHash = null;
    try {
      const assembledBuffer = await fs.promises.readFile(filePath);
      chunkedFileHash = crypto.createHash('sha256').update(assembledBuffer).digest('hex');
      const existingMedia = await findMediaByHash(userId, chunkedFileHash);
      if (existingMedia) {
        console.log(`[ChunkUpload] Deduplicación exitosa: archivo ya existe como ${existingMedia.filename} (Hash: ${chunkedFileHash})`);
        await fs.promises.unlink(filePath).catch(() => {});
        return res.status(200).json(existingMedia);
      }
    } catch (hashErr) {}

    // OPTIMIZACIÓN WEBP / WEBM + CIFRADO ZERO-KNOWLEDGE (AES-256-GCM)
    const baseSafeName = path.parse(safeName).name;
    const thumbName = `thumb_${fileId}.webp`;
    const thumbDir = path.join(UPLOADS_DIR, userId, 'thumbnails');
    await fs.promises.mkdir(thumbDir, { recursive: true });
    const thumbDiskPath = path.join(thumbDir, thumbName);

    let finalOptimizedPath = publicPath;
    let finalOptimizedFilename = `${baseSafeName}.${detectedType === 'video' ? 'webm' : 'webp'}`;
    let finalSize = totalSize;
    let cleanMime = detectedType === 'video' ? 'video/webm' : 'image/webp';
    let width = 1920;
    let height = 1080;
    let cloudStoragePath = '';
    let cloudUrl = '';
    let finalThumbnailUrl = publicPath;
    let memoryOptBuffer = null;

    if (detectedType === 'image') {
      const finalWebpName = `${fileId}_${baseSafeName}.webp`;
      const finalWebpPath = path.join(userUploadPath, finalWebpName);

      const opt = await optimizeImageToWebP(filePath);
      width = opt.width;
      height = opt.height;
      finalSize = opt.size;
      memoryOptBuffer = opt.buffer;

      const encrypted = encryptZeroKnowledge(opt.buffer);

      // Respaldo en Firebase Storage - ÚNICAMENTE en la carpeta media/ (Cero duplicación en thumbnails/)
      cloudStoragePath = `media/${userId}/image/${finalWebpName}.enc`;
      try {
        const cloudRes = await uploadToCloudStorage(cloudStoragePath, encrypted);
        cloudUrl = cloudRes.downloadUrl;
      } catch (err) {
        console.warn('[ChunkedUpload] Error subiendo imagen a Firebase Storage:', err.message);
      }

      // Limpieza inmediata de disco en el servidor
      await fs.promises.unlink(filePath).catch(() => {});
      await fs.promises.unlink(finalWebpPath).catch(() => {});

      finalOptimizedPath = `/uploads/${userId}/image/${finalWebpName}`;
      // La imagen es su propia miniatura: cero espacio duplicado en Firebase Storage
      finalThumbnailUrl = finalOptimizedPath;
    } else {
      const ext = path.extname(filename || '').toLowerCase() || '.mp4';
      const cleanExt = (ext === '.webm' || ext === '.mov') ? ext : '.mp4';
      const finalVideoName = `${fileId}_${baseSafeName}${cleanExt}`;
      const finalVideoPath = path.join(userUploadPath, finalVideoName);

      if (filePath !== finalVideoPath) {
        await fs.promises.copyFile(filePath, finalVideoPath);
      }

      const encVideoPath = `${finalVideoPath}.enc`;
      cloudStoragePath = `media/${userId}/video/${finalVideoName}.enc`;
      try {
        await encryptFileZeroKnowledge(finalVideoPath, encVideoPath);
        const cloudRes = await uploadToCloudStorage(cloudStoragePath, encVideoPath);
        cloudUrl = cloudRes.downloadUrl;
      } catch (err) {
        console.warn('[ChunkedUpload] Error subiendo video a Firebase Storage:', err.message);
      }

      // Limpieza inmediata de disco en el servidor
      await fs.promises.unlink(filePath).catch(() => {});
      await fs.promises.unlink(finalVideoPath).catch(() => {});
      await fs.promises.unlink(encVideoPath).catch(() => {});

      finalOptimizedPath = `/uploads/${userId}/video/${finalVideoName}`;
      // Usar miniatura base64 directa o URL directa: cero archivos duplicados en Firebase Storage
      finalThumbnailUrl = thumbnailB64 || finalOptimizedPath;
    }

    const newEntry = {
      id: fileId,
      userId,
      type: detectedType,
      url: finalOptimizedPath,
      path: finalOptimizedPath,
      thumbnailUrl: finalThumbnailUrl,
      cloudStoragePath,
      cloudUrl,
      filename: `${baseSafeName}.${detectedType === 'video' ? 'mp4' : 'webp'}`,
      title: filename,
      size: finalSize,
      fileHash: chunkedFileHash || undefined,
      width,
      height,
      mimeType: cleanMime,
      tags: [detectedType, 'upload', detectedType === 'video' ? 'video' : 'webp'],
      isPrivate: false,
      isAdultContent,
      albumId: albumId || null,
      albumIds: albumId ? [albumId] : [],
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      cameraSource: cameraSource || undefined,
      createdAt: new Date().toISOString()
    };

    // Auto-etiquetado con Gemini en segundo plano (asíncrono, cero retardo en la respuesta HTTP)
    if (detectedType === 'image' && memoryOptBuffer) {
      const optBuf = memoryOptBuffer;
      setTimeout(async () => {
        try {
          const dataUri = `data:image/webp;base64,${optBuf.toString('base64')}`;
          const aiResult = await autoTagImage(dataUri, [], '', filename || baseSafeName);
          if (aiResult?.tags?.length || aiResult?.description) {
            const updatedTags = Array.from(new Set([...newEntry.tags, ...(aiResult.tags || [])]));
            const { query } = await import('../db/index.js');
            await query('UPDATE media SET tags = $1, description = COALESCE($2, description) WHERE id = $3', [
              updatedTags,
              aiResult.description || null,
              fileId
            ]);
          }
        } catch (aiErr) {}
      }, 50);
    }

    await saveMediaMetadata(newEntry);

    // Si se especificó albumId, vincular inmediatamente al álbum en Neon PostgreSQL
    if (albumId) {
      try {
        const { query } = await import('../db/index.js');
        const albRes = await query('SELECT media_ids FROM albums WHERE id = $1', [albumId]);
        if (albRes.rows.length > 0) {
          const curIds = Array.isArray(albRes.rows[0].media_ids) ? albRes.rows[0].media_ids : [];
          const updatedIds = Array.from(new Set([...curIds, fileId]));
          await query('UPDATE albums SET media_ids = $1::jsonb, updated_at = NOW() WHERE id = $2', [JSON.stringify(updatedIds), albumId]);
          broadcastNeuralEvent('ALBUMS', { userId, albumId });
        }
      } catch (albErr) {
        console.warn('[ChunkedUpload] Fallo vinculando archivo al álbum:', albErr.message);
      }
    }

    await unlockAchievement(userId, 'first_upload');
    return res.status(200).json(newEntry);
  } catch (error) {
    console.error('[MediaController] Error en subida por fragmentos:', error);
    return res.status(500).json({ error: 'Falla al procesar el fragmento.', details: error.message });
  }
}

const VIDEO_DISK_CACHE_DIR = path.join(os.tmpdir(), 'pixelsphere_media_cache', 'videos');
const videoPreparePromises = new Map();

/**
 * Garantiza que el archivo de video esté descifrado y disponible en disco local para streaming HTTP 206
 * Cero consumo de RAM: descifra y transmite por streams sin cargar cientos de megabytes en memoria.
 */
export async function ensureVideoAvailableOnDisk(media) {
  if (!media) return null;
  await fs.promises.mkdir(VIDEO_DISK_CACHE_DIR, { recursive: true });
  
  const ext = (media.url || '').endsWith('.mp4') ? '.mp4' : '.webm';
  const diskDecryptedPath = path.join(VIDEO_DISK_CACHE_DIR, `${media.id}_decrypted${ext}`);

  if (fs.existsSync(diskDecryptedPath)) {
    try {
      const stat = await fs.promises.stat(diskDecryptedPath);
      if (stat.size > 0) return diskDecryptedPath;
    } catch (e) {}
  }

  // Deduplicación de peticiones concurrentes para el mismo activo
  if (videoPreparePromises.has(media.id)) {
    return await videoPreparePromises.get(media.id);
  }

  const preparePromise = (async () => {
    try {
      // 1. Verificar si ya existe en UPLOADS_DIR local
      const localUploaded = path.join(UPLOADS_DIR, (media.url || '').replace('/uploads/', ''));
      if (fs.existsSync(localUploaded)) {
        try {
          const stat = await fs.promises.stat(localUploaded);
          if (stat.size > 0) {
            // Verificar si tiene cabecera PXZK
            const fd = await fs.promises.open(localUploaded, 'r');
            const head = Buffer.alloc(4);
            await fd.read(head, 0, 4, 0);
            await fd.close();
            if (head.toString('utf-8') === 'PXZK') {
              await decryptFileZeroKnowledge(localUploaded, diskDecryptedPath);
              return diskDecryptedPath;
            }
            return localUploaded;
          }
        } catch (e) {}
      }

      // 2. Descargar archivo cifrado desde Firebase Storage directamente a disco (sin RAM)
      const cloudPath = media.cloudStoragePath || `media/${media.userId}/video/${path.basename(media.url || '')}.enc`;
      const diskEncryptedPath = path.join(VIDEO_DISK_CACHE_DIR, `${media.id}_encrypted.enc`);

      let downloaded = await downloadFromCloudStorageToFile(cloudPath, diskEncryptedPath);
      if (!downloaded || !fs.existsSync(diskEncryptedPath)) {
        // Intentar ruta sin sufijo .enc
        const altCloud = cloudPath.replace(/\.enc$/, '');
        downloaded = await downloadFromCloudStorageToFile(altCloud, diskEncryptedPath);
      }

      if (!downloaded || !fs.existsSync(diskEncryptedPath)) {
        throw new Error('Archivo de video no encontrado en Firebase Storage.');
      }

      // 3. Descifrar con streams en disco
      await decryptFileZeroKnowledge(diskEncryptedPath, diskDecryptedPath);
      await fs.promises.unlink(diskEncryptedPath).catch(() => {});

      return diskDecryptedPath;
    } catch (err) {
      console.error(`[MediaController] Error preparando video ${media.id} en disco:`, err.message);
      await fs.promises.unlink(diskDecryptedPath).catch(() => {});
      throw err;
    } finally {
      videoPreparePromises.delete(media.id);
    }
  })();

  videoPreparePromises.set(media.id, preparePromise);
  return await preparePromise;
}

/**
 * STREAMING HTTP 206 (Range headers) DIRECTO DESDE DISCO LOCAL
 * Cero consumo de memoria RAM: respuesta instantánea en milisegundos sin pausas ni bloqueos.
 */
export async function streamVideo(req, res) {
  try {
    const { id } = req.params;
    let media = await findMediaById(id);

    if (!media) {
      try {
        const { query } = await import('../db/index.js');
        const dbRes = await query('SELECT * FROM media WHERE id = $1 OR url LIKE $2 LIMIT 1', [id, `%${id}%`]);
        if (dbRes?.rows?.[0]) {
          const { mapMediaFromDb } = await import('../services/storageService.js');
          media = mapMediaFromDb(dbRes.rows[0]);
        }
      } catch (e) {}
    }

    if (!media) return res.status(404).send('Video no encontrado');

    const localVideoPath = await ensureVideoAvailableOnDisk(media);
    if (!localVideoPath || !fs.existsSync(localVideoPath)) {
      return res.status(404).send('Archivo físico de video no encontrado.');
    }

    const stat = await fs.promises.stat(localVideoPath);
    const fileSize = stat.size;

    let mime = 'video/webm';
    if ((media.url || localVideoPath).endsWith('.mp4')) mime = 'video/mp4';
    else if ((media.url || localVideoPath).endsWith('.mov')) mime = 'video/quicktime';
    else if ((media.url || localVideoPath).endsWith('.mkv')) mime = 'video/x-matroska';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes'
      });
      return res.end();
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });

      const stream = fs.createReadStream(localVideoPath, { start, end });
      req.on('close', () => stream.destroy());
      return stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes'
      });
      const stream = fs.createReadStream(localVideoPath);
      req.on('close', () => stream.destroy());
      return stream.pipe(res);
    }
  } catch (error) {
    console.error('[MediaController] Error en streaming de video:', error);
    return res.status(500).send('Error durante el streaming.');
  }
}

export async function updateMedia(req, res) {
  try {
    const { id } = req.params;
    const { userId, updates } = req.body;
    const updated = await updateMediaStorage(id, userId, updates);
    if (!updated) return res.status(404).json({ error: 'Medio no encontrado o sin permisos.' });
    return res.json({ success: true, media: updated });
  } catch (error) {
    console.error('[MediaController] Error al actualizar medio:', error);
    return res.status(500).json({ error: 'Error al actualizar medio.' });
  }
}

export async function deleteMedia(req, res) {
  try {
    const { id } = req.params;
    const userId = req.body?.userId || req.query?.userId || req.headers['x-user-id'];
    const permanent = req.body?.permanent === true || req.query?.permanent === 'true';
    const ok = await deleteMediaStorage(id, userId, permanent);
    if (!ok) return res.status(404).json({ error: 'Medio no encontrado.' });
    return res.json({ success: true, permanent });
  } catch (error) {
    console.error('[MediaController] Error al eliminar medio:', error);
    return res.status(500).json({ error: 'Error al eliminar medio.' });
  }
}

export async function deleteMultiple(req, res) {
  try {
    const { ids, userId, permanent } = req.body;
    const isPermanent = permanent === true || req.query?.permanent === 'true';
    const ok = await deleteMultipleMedia(ids, userId, isPermanent);
    return res.json({ success: ok, permanent: isPermanent });
  } catch (error) {
    console.error('[MediaController] Error en eliminación múltiple:', error);
    return res.status(500).json({ error: 'Error en eliminación múltiple.' });
  }
}

export async function emptyTrashController(req, res) {
  try {
    const userId = req.body?.userId || req.query?.userId || req.headers['x-user-id'];
    const ok = await emptyTrash(userId);
    return res.json({ success: ok });
  } catch (error) {
    console.error('[MediaController] Error al vaciar papelera:', error);
    return res.status(500).json({ error: 'Error al vaciar papelera.' });
  }
}

export async function cleanupTrashController(req, res) {
  try {
    const days = parseInt(req.query?.days || req.body?.days || '30', 10);
    const result = await cleanupExpiredTrash(days);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[MediaController] Error en purga de papelera:', error);
    return res.status(500).json({ error: 'Error en purga de papelera.' });
  }
}

export async function restoreMultiple(req, res) {
  try {
    const { ids, userId } = req.body;
    const ok = await restoreMultipleMedia(ids, userId);
    return res.json({ success: ok });
  } catch (error) {
    console.error('[MediaController] Error al restaurar medios:', error);
    return res.status(500).json({ error: 'Error al restaurar medios.' });
  }
}

export async function recordView(req, res) {
  try {
    const { id } = req.params;
    const { userId, source, device, ip } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const rawIp = ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';

    let deviceName = device;
    if (!deviceName) {
      if (/mobile|android|iphone|ipod/i.test(userAgent)) {
        deviceName = 'Dispositivo Móvil';
      } else if (/ipad|tablet/i.test(userAgent)) {
        deviceName = 'Tablet';
      } else {
        deviceName = 'Escritorio (PC/Laptop)';
      }
    }

    if (userId) {
      const cleanIp = clientIp === '::1' || clientIp === '::ffff:127.0.0.1' ? '127.0.0.1 (Local)' : clientIp;
      const updatedUser = await recordMediaView(userId, id, {
        source: source || 'Galería Principal',
        deviceName,
        clientIp: cleanIp
      });
      return res.json({ success: true, history: updatedUser?.viewHistory || [] });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[MediaController] Error al registrar visualización:', error);
    return res.status(500).json({ error: 'Error al registrar vista.' });
  }
}

export async function saveProgress(req, res) {
  try {
    const { id } = req.params;
    const { userId, seconds } = req.body;
    if (userId) await updateVideoProgress(userId, id, seconds);
    return res.json({ success: true });
  } catch (error) {
    console.error('[MediaController] Error guardando progreso:', error);
    return res.status(500).json({ error: 'Error guardando progreso.' });
  }
}
