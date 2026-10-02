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

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': media.mimeType || 'video/mp4',
      };

      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': media.mimeType || 'video/mp4',
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
