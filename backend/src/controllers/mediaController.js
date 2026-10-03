import fs from 'node:fs';
import path from 'node:path';
import { 
  getMedia, 
  getMediaByUser, 
  findMediaById, 
  saveMediaMetadata, 
  updateMedia as updateMediaStorage, 
  deleteMedia as deleteMediaStorage,
  deleteMultipleMedia,
  restoreMultipleMedia,
  recordMediaView,
  updateVideoProgress,
  findUserById,
  unlockAchievement
} from '../services/storageService.js';
import { UPLOADS_DIR } from '../config/constants.js';
import { autoTagImage } from '../services/geminiService.js';

export async function listMedia(req, res) {
  try {
    const { userId, type, isDeleted, isPrivate, albumId, query } = req.query;
    let items = userId ? await getMediaByUser(userId) : await getMedia();

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
    const type = isVideo ? 'video' : 'image';
    const cleanUserId = userId || 'anonymous';

    const relativeUrl = `/uploads/${cleanUserId}/${type}/${file.filename}`;
    const mediaId = Math.random().toString(36).substring(2, 11);

    const newMedia = {
      id: mediaId,
      userId: cleanUserId,
      type,
      url: relativeUrl,
      path: relativeUrl,
      thumbnailUrl: relativeUrl,
      filename: file.originalname,
      title: title || file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      tags: [type, 'upload'],
      isPrivate: isPrivate === 'true' || isPrivate === true,
      albumId: albumId || null,
      createdAt: new Date().toISOString(),
      metadata: {
        width: 1920,
        height: 1080,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined
      }
    };

    // Auto-etiquetado inteligente con Gemini si es imagen
    if (!isVideo) {
      try {
        const filePath = file.path;
        const fileBuffer = fs.readFileSync(filePath);
        const dataUri = `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
        const aiResult = await autoTagImage(dataUri);
        if (aiResult.tags && aiResult.tags.length > 0) {
          newMedia.tags = Array.from(new Set([...newMedia.tags, ...aiResult.tags]));
        }
        if (aiResult.description) {
          newMedia.description = aiResult.description;
        }
      } catch (aiErr) {
        console.warn('[MediaController] Auto-etiquetado omitido o fallido:', aiErr.message);
      }
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
      thumbnailB64
    } = req.body;

    if (!userId || !filename || !chunkFile) {
      return res.status(400).json({ error: 'Faltan metadatos o fragmento de archivo.' });
    }

    const fileId = reqFileId || Math.random().toString(36).substring(2, 11);
    const chunkIndex = parseInt(rawChunkIndex ?? '0', 10);
    const totalChunks = parseInt(rawTotalChunks ?? '1', 10);
    const isAdultContent = isAdult === 'true' || isAdult === true;
    const totalSize = parseInt(filesize ?? '0', 10) || chunkFile.size;

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
        await new Promise((resolve) => writeStream.end(resolve));

        // Limpiar el directorio temporal
        await fs.promises.rm(tempChunksDir, { recursive: true, force: true }).catch(() => {});
      } else {
        return res.status(200).json({ status: 'chunk_received', index: chunkIndex });
      }
    }

    const thumbName = `thumb_${fileId}.jpg`;
    const thumbDiskPath = path.join(UPLOADS_DIR, userId, 'thumbnails', thumbName);
    let finalThumbnailUrl = fs.existsSync(thumbDiskPath) 
      ? `/uploads/${userId}/thumbnails/${thumbName}` 
      : (detectedType === 'video' ? `${publicPath}#t=0.5` : publicPath);

    let cleanMime = contentType || chunkFile.mimetype;
    if (!cleanMime || cleanMime === 'application/octet-stream') {
      if (/\.mp4$/i.test(filename)) cleanMime = 'video/mp4';
      else if (/\.webm$/i.test(filename)) cleanMime = 'video/webm';
      else if (/\.mov$/i.test(filename)) cleanMime = 'video/quicktime';
      else if (/\.mkv$/i.test(filename)) cleanMime = 'video/x-matroska';
      else if (/\.jpg|\.jpeg$/i.test(filename)) cleanMime = 'image/jpeg';
      else if (/\.png$/i.test(filename)) cleanMime = 'image/png';
      else cleanMime = detectedType === 'video' ? 'video/mp4' : 'image/jpeg';
    }

    const newEntry = {
      id: fileId,
      userId,
      type: detectedType,
      url: publicPath,
      path: publicPath,
      thumbnailUrl: finalThumbnailUrl,
      filename,
      title: filename,
      size: totalSize,
      width: 1920,
      height: 1080,
      mimeType: cleanMime,
      tags: [detectedType, 'upload'],
      isPrivate: false,
      isAdultContent,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      cameraSource: cameraSource || undefined,
      createdAt: new Date().toISOString()
    };

    // Auto-etiquetado con Gemini solo para imágenes
    if (detectedType === 'image') {
      try {
        const fileBuffer = await fs.promises.readFile(filePath);
        const dataUri = `data:${newEntry.mimeType};base64,${fileBuffer.toString('base64')}`;
        const aiResult = await autoTagImage(dataUri);
        if (aiResult?.tags?.length) {
          newEntry.tags = Array.from(new Set([...newEntry.tags, ...aiResult.tags]));
        }
        if (aiResult?.description) {
          newEntry.description = aiResult.description;
        }
      } catch (aiErr) {
        // Ignorar fallo de Gemini opcional
      }
    }

    await saveMediaMetadata(newEntry);
    await unlockAchievement(userId, 'first_upload');
    return res.status(200).json(newEntry);
  } catch (error) {
    console.error('[MediaController] Error en subida por fragmentos:', error);
    return res.status(500).json({ error: 'Falla al procesar el fragmento.', details: error.message });
  }
}

/**
 * STREAMING HTTP 206 (Range headers) PARA REPRODUCCIÓN FLUIDA DE VIDEO
 */
export async function streamVideo(req, res) {
  try {
    const { id } = req.params;
    const media = await findMediaById(id);
    if (!media) return res.status(404).send('Video no encontrado');

    // Resolver ruta física en disco
    const relativePart = media.url.replace(/^\/uploads\//, '');
    const videoPath = path.join(UPLOADS_DIR, relativePart);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).send('Archivo físico de video no encontrado en disco.');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    let mime = media.mimeType || 'video/mp4';
    if (!mime || mime === 'application/octet-stream') {
      if (videoPath.endsWith('.webm')) mime = 'video/webm';
      else if (videoPath.endsWith('.mov')) mime = 'video/quicktime';
      else if (videoPath.endsWith('.mkv')) mime = 'video/x-matroska';
      else mime = 'video/mp4';
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
        });
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      };

      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
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
    const { userId } = req.body;
    const ok = await deleteMediaStorage(id, userId);
    if (!ok) return res.status(404).json({ error: 'Medio no encontrado.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('[MediaController] Error al eliminar medio:', error);
    return res.status(500).json({ error: 'Error al eliminar medio.' });
  }
}

export async function deleteMultiple(req, res) {
  try {
    const { ids, userId } = req.body;
    const ok = await deleteMultipleMedia(ids, userId);
    return res.json({ success: ok });
  } catch (error) {
    console.error('[MediaController] Error en eliminación múltiple:', error);
    return res.status(500).json({ error: 'Error en eliminación múltiple.' });
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
    const { userId } = req.body;
    if (userId) await recordMediaView(userId, id);
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
