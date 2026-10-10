import { 
  getAlbums, 
  getAlbumsByUser, 
  createAlbum as createAlbumStorage, 
  updateAlbum as updateAlbumStorage, 
  deleteAlbum as deleteAlbumStorage,
  getMedia,
  updateMedia,
  updateMultipleMedia
} from '../services/storageService.js';
import { broadcastNeuralEvent } from '../services/eventService.js';

export async function listAlbums(req, res) {
  try {
    const { userId, all } = req.query;
    let albums = await getAlbums();
    if (userId && all === 'false') {
      albums = albums.filter(a => a.userId === userId);
    }
    return res.json(albums);
  } catch (error) {
    console.error('[AlbumController] Error al listar álbumes:', error);
    return res.status(500).json({ error: 'Error al listar álbumes.' });
  }
}

export async function getAlbumById(req, res) {
  try {
    const { id } = req.params;
    const all = await getAlbums();
    const album = all.find(a => a.id === id);
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado.' });
    return res.json(album);
  } catch (error) {
    console.error('[AlbumController] Error al obtener álbum:', error);
    return res.status(500).json({ error: 'Error al obtener álbum.' });
  }
}

export async function createAlbum(req, res) {
  try {
    const { userId, title, description, parentId, coverMediaId, isPrivate } = req.body;
    if (!title || !userId) {
      return res.status(400).json({ error: 'Título y usuario requeridos.' });
    }

    const newAlbum = {
      id: req.body.id || Math.random().toString(36).substring(2, 11),
      userId,
      title,
      description: description || '',
      parentId: parentId || null,
      coverMediaId: coverMediaId || null,
      mediaIds: Array.isArray(req.body.mediaIds) ? req.body.mediaIds : [],
      isPrivate: !!isPrivate,
      createdAt: req.body.createdAt || new Date().toISOString()
    };

    const saved = await createAlbumStorage(newAlbum);
    return res.status(201).json({ success: true, album: saved });
  } catch (error) {
    console.error('[AlbumController] Error al crear álbum:', error);
    return res.status(500).json({ error: 'Error al crear álbum.' });
  }
}

export async function updateAlbum(req, res) {
  try {
    const { id } = req.params;
    const { userId, updates } = req.body;
    const updated = await updateAlbumStorage(id, userId, updates);
    if (!updated) return res.status(404).json({ error: 'Álbum no encontrado o sin permisos.' });
    return res.json({ success: true, album: updated });
  } catch (error) {
    console.error('[AlbumController] Error al actualizar álbum:', error);
    return res.status(500).json({ error: 'Error al actualizar álbum.' });
  }
}

export async function deleteAlbum(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const deletedIds = await deleteAlbumStorage(id, userId);
    return res.json({ success: true, deletedIds });
  } catch (error) {
    console.error('[AlbumController] Error al eliminar álbum:', error);
    return res.status(500).json({ error: 'Error al eliminar álbum.' });
  }
}

export async function addMediaToAlbum(req, res) {
  try {
    const { id } = req.params;
    const { userId, mediaIds } = req.body;
    if (!mediaIds || !Array.isArray(mediaIds)) {
      return res.status(400).json({ error: 'Se requiere una lista de IDs de medios.' });
    }

    // 1. Actualizar album.mediaIds en base de datos PostgreSQL
    const albums = await getAlbums();
    const album = albums.find(a => a.id === id);
    if (album) {
      const currentIds = Array.isArray(album.mediaIds) ? album.mediaIds : [];
      const updatedMediaIds = Array.from(new Set([...currentIds, ...mediaIds]));
      await updateAlbumStorage(id, userId, { mediaIds: updatedMediaIds });
    }

    // 2. Actualizar media en base de datos PostgreSQL
    const allMedia = await getMedia();
    const mediaSet = new Set(mediaIds);
    for (const m of allMedia) {
      if (mediaSet.has(m.id)) {
        const currentAlbumIds = Array.isArray(m.albumIds) ? m.albumIds : (m.albumId ? [m.albumId] : []);
        const nextAlbumIds = Array.from(new Set([...currentAlbumIds, id]));
        await updateMedia(m.id, userId, { albumId: id, albumIds: nextAlbumIds });
      }
    }

    broadcastNeuralEvent('ALBUMS', { userId, albumId: id });
    broadcastNeuralEvent('MEDIA', { userId });

    return res.json({ success: true, count: mediaIds.length });
  } catch (error) {
    console.error('[AlbumController] Error al añadir medios al álbum:', error);
    return res.status(500).json({ error: 'Error al añadir medios al álbum.' });
  }
}

export async function removeMediaFromAlbum(req, res) {
  try {
    const { id } = req.params;
    const { userId, mediaIds } = req.body;
    if (!mediaIds || !Array.isArray(mediaIds)) {
      return res.status(400).json({ error: 'Se requiere una lista de IDs de medios.' });
    }

    // 1. Remover de album.mediaIds
    const albums = await getAlbums();
    const album = albums.find(a => a.id === id);
    if (album) {
      const currentIds = Array.isArray(album.mediaIds) ? album.mediaIds : [];
      const removeSet = new Set(mediaIds);
      const updatedMediaIds = currentIds.filter(mId => !removeSet.has(mId));
      await updateAlbumStorage(id, userId, { mediaIds: updatedMediaIds });
    }

    // 2. Remover de media.albumId / media.albumIds
    const allMedia = await getMedia();
    const removeSet = new Set(mediaIds);
    for (const m of allMedia) {
      if (removeSet.has(m.id)) {
        const currentAlbumIds = Array.isArray(m.albumIds) ? m.albumIds : (m.albumId ? [m.albumId] : []);
        const nextAlbumIds = currentAlbumIds.filter(aId => aId !== id);
        const nextAlbumId = m.albumId === id ? (nextAlbumIds[0] || null) : m.albumId;
        await updateMedia(m.id, userId, { albumId: nextAlbumId, albumIds: nextAlbumIds });
      }
    }

    broadcastNeuralEvent('ALBUMS', { userId, albumId: id });
    broadcastNeuralEvent('MEDIA', { userId });

    return res.json({ success: true, count: mediaIds.length });
  } catch (error) {
    console.error('[AlbumController] Error al remover medios del álbum:', error);
    return res.status(500).json({ error: 'Error al remover medios del álbum.' });
  }
}
