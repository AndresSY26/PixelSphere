import { 
  getAlbums, 
  getAlbumsByUser, 
  createAlbum as createAlbumStorage, 
  updateAlbum as updateAlbumStorage, 
  deleteAlbum as deleteAlbumStorage,
  getMediaByUser,
  updateMultipleMedia
} from '../services/storageService.js';

export async function listAlbums(req, res) {
  try {
    const { userId } = req.query;
    const albums = userId ? await getAlbumsByUser(userId) : await getAlbums();
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
      id: Math.random().toString(36).substring(2, 11),
      userId,
      title,
      description: description || '',
      parentId: parentId || null,
      coverMediaId: coverMediaId || null,
      isPrivate: !!isPrivate,
      createdAt: new Date().toISOString()
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

    await updateMultipleMedia(mediaIds, userId, { albumId: id });
    return res.json({ success: true, count: mediaIds.length });
  } catch (error) {
    console.error('[AlbumController] Error al añadir medios al álbum:', error);
    return res.status(500).json({ error: 'Error al añadir medios al álbum.' });
  }
}
