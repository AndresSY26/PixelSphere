import { 
  getAlbums, 
  getAlbumsByUser, 
  createAlbum as createAlbumStorage, 
  updateAlbum as updateAlbumStorage, 
  deleteAlbum as deleteAlbumStorage,
  getMedia,
  updateMedia,
  updateMultipleMedia,
  findMediaById
} from '../services/storageService.js';
import { broadcastNeuralEvent } from '../services/eventService.js';
import { query } from '../db/index.js';

export async function listAlbums(req, res) {
  try {
    const { userId, all } = req.query;
    let albums = await getAlbums();

    // Reconciliación bidireccional automática con la base de datos de medios:
    // Asegura que cualquier medio con album_id o album_ids se refleje en mediaIds del álbum
    try {
      const allMedia = await getMedia();
      const mediaByAlbum = new Map();
      for (const m of allMedia) {
        if (m.isDeleted) continue;
        if (m.albumId) {
          if (!mediaByAlbum.has(m.albumId)) mediaByAlbum.set(m.albumId, new Set());
          mediaByAlbum.get(m.albumId).add(m.id);
        }
        if (Array.isArray(m.albumIds)) {
          for (const aid of m.albumIds) {
            if (!mediaByAlbum.has(aid)) mediaByAlbum.set(aid, new Set());
            mediaByAlbum.get(aid).add(m.id);
          }
        }
      }

      albums = albums.map(a => {
        const explicitIds = Array.isArray(a.mediaIds) ? a.mediaIds : [];
        const derivedIds = mediaByAlbum.get(a.id) ? Array.from(mediaByAlbum.get(a.id)) : [];
        const combined = Array.from(new Set([...explicitIds, ...derivedIds]));
        return { ...a, mediaIds: combined };
      });
    } catch (recErr) {
      console.warn('[AlbumController] Reconciliación omitida:', recErr.message);
    }

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
    let albums = await getAlbums();
    let album = albums.find(a => a.id === id);
    if (!album) {
      const dbRes = await query('SELECT * FROM albums WHERE id = $1', [id]);
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        album = {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          description: row.description || '',
          parentId: row.parent_id || null,
          coverMediaId: row.cover_media_id || null,
          isPublic: !!row.is_public,
          sharedWith: Array.isArray(row.shared_with) ? row.shared_with : [],
          mediaIds: Array.isArray(row.media_ids) ? row.media_ids : [],
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
        };
      }
    }
    if (!album) return res.status(404).json({ error: 'Álbum no encontrado.' });

    // Reconciliar con medios en tiempo real
    try {
      const allMedia = await getMedia();
      const linkedMediaIds = allMedia
        .filter(m => !m.isDeleted && (m.albumId === id || (Array.isArray(m.albumIds) && m.albumIds.includes(id))))
        .map(m => m.id);
      album.mediaIds = Array.from(new Set([...(album.mediaIds || []), ...linkedMediaIds]));
    } catch (e) {}

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

    // Validar clave foránea de usuario para evitar rechazo en Neon PostgreSQL
    let targetUserId = userId;
    try {
      const uRes = await query('SELECT id FROM users WHERE id = $1', [targetUserId]);
      if (uRes.rows.length === 0) {
        const anyU = await query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
        if (anyU.rows.length > 0) {
          targetUserId = anyU.rows[0].id;
        } else {
          targetUserId = 'default_user';
          await query(
            'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [targetUserId, 'user_' + targetUserId, 'user@example.com', 'NOPASSWORD']
          );
        }
      }
    } catch (fkErr) {
      console.warn('[AlbumController] Advertencia verificando usuario para álbum:', fkErr.message);
    }

    const newAlbum = {
      id: req.body.id || Math.random().toString(36).substring(2, 11),
      userId: targetUserId,
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
    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de IDs de medios.' });
    }

    // 1. Obtener y actualizar album.mediaIds en base de datos PostgreSQL
    let albums = await getAlbums();
    let album = albums.find(a => a.id === id);
    if (!album) {
      const dbRes = await query('SELECT * FROM albums WHERE id = $1', [id]);
      if (dbRes.rows.length > 0) {
        album = {
          id: dbRes.rows[0].id,
          userId: dbRes.rows[0].user_id,
          title: dbRes.rows[0].title,
          description: dbRes.rows[0].description || '',
          mediaIds: Array.isArray(dbRes.rows[0].media_ids) ? dbRes.rows[0].media_ids : []
        };
      }
    }

    if (!album) {
      return res.status(404).json({ error: 'Álbum no encontrado.' });
    }

    const currentIds = Array.isArray(album.mediaIds) ? album.mediaIds : [];
    const updatedMediaIds = Array.from(new Set([...currentIds, ...mediaIds]));

    await query(
      'UPDATE albums SET media_ids = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedMediaIds), id]
    );
    album.mediaIds = updatedMediaIds;

    // 2. Actualizar media en base de datos PostgreSQL
    for (const mId of mediaIds) {
      try {
        const curMedia = await findMediaById(mId);
        const curAlbumIds = curMedia && Array.isArray(curMedia.albumIds) ? curMedia.albumIds : (curMedia?.albumId ? [curMedia.albumId] : []);
        const nextAlbumIds = Array.from(new Set([...curAlbumIds, id]));
        await query(
          'UPDATE media SET album_id = $1, album_ids = $2::jsonb, updated_at = NOW() WHERE id = $3',
          [id, JSON.stringify(nextAlbumIds), mId]
        );
      } catch (mErr) {
        console.warn(`[AlbumController] Error vinculando medio ${mId}:`, mErr.message);
      }
    }

    broadcastNeuralEvent('ALBUMS', { userId: album.userId || userId, albumId: id });
    broadcastNeuralEvent('MEDIA', { userId: album.userId || userId });

    return res.json({ 
      success: true, 
      count: mediaIds.length, 
      album, 
      mediaIds: updatedMediaIds 
    });
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

    let albums = await getAlbums();
    let album = albums.find(a => a.id === id);
    if (!album) {
      const dbRes = await query('SELECT * FROM albums WHERE id = $1', [id]);
      if (dbRes.rows.length > 0) {
        album = {
          id: dbRes.rows[0].id,
          userId: dbRes.rows[0].user_id,
          title: dbRes.rows[0].title,
          description: dbRes.rows[0].description || '',
          mediaIds: Array.isArray(dbRes.rows[0].media_ids) ? dbRes.rows[0].media_ids : []
        };
      }
    }

    if (!album) {
      return res.status(404).json({ error: 'Álbum no encontrado.' });
    }

    const currentIds = Array.isArray(album.mediaIds) ? album.mediaIds : [];
    const removeSet = new Set(mediaIds);
    const updatedMediaIds = currentIds.filter(mId => !removeSet.has(mId));

    await query(
      'UPDATE albums SET media_ids = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedMediaIds), id]
    );
    album.mediaIds = updatedMediaIds;

    for (const mId of mediaIds) {
      try {
        const curMedia = await findMediaById(mId);
        const curAlbumIds = curMedia && Array.isArray(curMedia.albumIds) ? curMedia.albumIds : (curMedia?.albumId ? [curMedia.albumId] : []);
        const nextAlbumIds = curAlbumIds.filter(aId => aId !== id);
        const nextAlbumId = curMedia?.albumId === id ? (nextAlbumIds[0] || null) : (curMedia?.albumId || null);
        await query(
          'UPDATE media SET album_id = $1, album_ids = $2::jsonb, updated_at = NOW() WHERE id = $3',
          [nextAlbumId, JSON.stringify(nextAlbumIds), mId]
        );
      } catch (mErr) {
        console.warn(`[AlbumController] Error desvinculando medio ${mId}:`, mErr.message);
      }
    }

    broadcastNeuralEvent('ALBUMS', { userId: album.userId || userId, albumId: id });
    broadcastNeuralEvent('MEDIA', { userId: album.userId || userId });

    return res.json({ 
      success: true, 
      count: mediaIds.length, 
      album, 
      mediaIds: updatedMediaIds 
    });
  } catch (error) {
    console.error('[AlbumController] Error al remover medios del álbum:', error);
    return res.status(500).json({ error: 'Error al remover medios del álbum.' });
  }
}

