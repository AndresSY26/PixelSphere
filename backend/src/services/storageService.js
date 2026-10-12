import path from 'node:path';
import { broadcastNeuralEvent } from './eventService.js';
import { query, initDatabase } from '../db/index.js';
import { deleteFromCloudStorage } from './cloudStorageService.js';

/**
 * PIXELSPHERE STORAGE SERVICE v60.0 (Neon PostgreSQL + Cache Híbrido)
 * Motor relacional PostgreSQL respaldado por Neon con sincronización en tiempo real.
 */

const CACHE = {
  users: [],
  media: [],
  albums: [],
  achievements: [],
  isInitialized: false
};

function enforceSecurityPolicies(users) {
  let changed = false;
  const nextUsers = users.map(user => {
    const isMainAdmin = user.email === 'andresksa123@gmail.com';
    const targetRole = isMainAdmin ? 'admin' : (user.role || 'user');
    
    let updatedUser = { ...user };
    
    if (user.role !== targetRole) {
      updatedUser.role = targetRole;
      changed = true;
    }

    if (isMainAdmin && (user.is2FAEnabled || user.twoFASecret)) {
      updatedUser.is2FAEnabled = false;
      delete updatedUser.twoFASecret;
      changed = true;
    }

    return updatedUser;
  });

  return { users: nextUsers, changed };
}

// Mapeos de filas SQL a objetos del frontend
function mapUserFromDb(row, viewHistory = []) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role || 'user',
    avatarUrl: row.avatar_url || '',
    is2FAEnabled: !!row.is_2fa_enabled,
    twoFASecret: row.two_fa_secret || undefined,
    authProvider: row.auth_provider || 'local',
    isGoogleLinked: !!row.is_google_linked,
    plan: row.plan || 'free',
    storageQuota: parseInt(row.storage_quota, 10) || 3221225472,
    storageUsed: parseInt(row.storage_used, 10) || 0,
    vaultPasswordHash: row.vault_password_hash || undefined,
    settings: row.settings || {},
    filterPreferences: row.filter_preferences || {},
    videoProgress: row.video_progress || {},
    sessions: row.sessions || [],
    viewHistory: viewHistory || [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function mapMediaFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename,
    originalName: row.original_name || row.filename,
    mimeType: row.mime_type || 'image/png',
    type: row.type || 'image',
    size: parseInt(row.size, 10) || 0,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || row.url,
    width: row.width || null,
    height: row.height || null,
    duration: row.duration || null,
    isAdultContent: !!row.is_adult_content,
    nsfwScore: parseFloat(row.nsfw_score || 0),
    tags: Array.isArray(row.tags) ? row.tags : [],
    visualTags: Array.isArray(row.visual_tags) ? row.visual_tags : [],
    description: row.description || '',
    albumId: row.album_id || null,
    albumIds: Array.isArray(row.album_ids) ? row.album_ids : [],
    sharedWith: Array.isArray(row.shared_with) ? row.shared_with : [],
    isShared: !!row.is_shared,
    isDeleted: !!row.is_deleted,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    source: row.source || null,
    camera: row.camera || null,
    fileHash: row.file_hash || null,
    cloudStoragePath: row.cloud_storage_path || null,
    cloudUrl: row.cloud_url || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function mapAlbumFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    parentId: row.parent_id || null,
    coverMediaId: row.cover_media_id || null,
    isPublic: !!row.is_public,
    sharedWith: Array.isArray(row.shared_with) ? row.shared_with : [],
    mediaIds: Array.isArray(row.media_ids) ? row.media_ids : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

let initPromise = null;
export async function ensureDirectories() {
  if (CACHE.isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Inicializar tablas en Neon PostgreSQL
    try {
      await initDatabase();
      console.log('[StorageService] Conexión establecida con Neon PostgreSQL con éxito.');
    } catch (err) {
      console.error('[StorageService] Error conectando a Neon PostgreSQL:', err);
    }

    // Cargar caché inicial desde PostgreSQL
    try {
      const [usersRes, mediaRes, albumsRes, achievementsRes] = await Promise.all([
        query('SELECT * FROM users ORDER BY created_at DESC'),
        query('SELECT * FROM media ORDER BY created_at DESC'),
        query('SELECT * FROM albums ORDER BY created_at DESC'),
        query('SELECT * FROM achievements ORDER BY unlocked_at DESC')
      ]);

      CACHE.media = mediaRes.rows.map(mapMediaFromDb);
      CACHE.albums = albumsRes.rows.map(mapAlbumFromDb);

      // Reconciliación bidireccional automática entre medios y álbumes
      const mediaByAlbum = new Map();
      CACHE.media.forEach(m => {
        if (m.isDeleted) return;
        if (m.albumId) {
          if (!mediaByAlbum.has(m.albumId)) mediaByAlbum.set(m.albumId, new Set());
          mediaByAlbum.get(m.albumId).add(m.id);
        }
        if (Array.isArray(m.albumIds)) {
          m.albumIds.forEach(aid => {
            if (!mediaByAlbum.has(aid)) mediaByAlbum.set(aid, new Set());
            mediaByAlbum.get(aid).add(m.id);
          });
        }
      });

      CACHE.albums.forEach(a => {
        const explicit = Array.isArray(a.mediaIds) ? a.mediaIds : [];
        const derived = mediaByAlbum.has(a.id) ? Array.from(mediaByAlbum.get(a.id)) : [];
        a.mediaIds = Array.from(new Set([...explicit, ...derived]));
      });
      CACHE.achievements = achievementsRes.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        badgeId: r.badge_id,
        unlockedAt: r.unlocked_at ? new Date(r.unlocked_at).toISOString() : new Date().toISOString()
      }));

      // Cargar historial para cada usuario
      const historyRes = await query('SELECT * FROM view_history ORDER BY viewed_at DESC');
      const historyByUser = new Map();
      historyRes.rows.forEach(h => {
        if (!historyByUser.has(h.user_id)) historyByUser.set(h.user_id, []);
        historyByUser.get(h.user_id).push({
          id: h.id,
          mediaId: h.media_id,
          source: h.source,
          deviceName: h.device_name,
          clientIp: h.client_ip,
          viewedAt: new Date(h.viewed_at).toISOString()
        });
      });

      CACHE.users = usersRes.rows.map(u => mapUserFromDb(u, historyByUser.get(u.id) || []));
      
      const sec = enforceSecurityPolicies(CACHE.users);
      CACHE.users = sec.users;

      console.log(`[StorageService] Caché sincronizado desde PostgreSQL: ${CACHE.users.length} usuarios, ${CACHE.media.length} medios, ${CACHE.albums.length} álbumes.`);
    } catch (err) {
      console.error('[StorageService] Fallo cargando datos iniciales de PostgreSQL:', err);
    }

    CACHE.isInitialized = true;
  })();

  return initPromise;
}

// ==================== USUARIOS ====================

export async function getUsers() {
  await ensureDirectories();
  return CACHE.users;
}

export async function findUserById(id) {
  await ensureDirectories();
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return null;
    const historyRes = await query('SELECT * FROM view_history WHERE user_id = $1 ORDER BY viewed_at DESC LIMIT 100', [id]);
    const history = historyRes.rows.map(h => ({
      id: h.id,
      mediaId: h.media_id,
      source: h.source,
      deviceName: h.device_name,
      clientIp: h.client_ip,
      viewedAt: new Date(h.viewed_at).toISOString()
    }));
    return mapUserFromDb(userRes.rows[0], history);
  } catch (err) {
    return CACHE.users.find(u => u.id === id) || null;
  }
}

export async function findUserByEmail(email) {
  await ensureDirectories();
  try {
    const userRes = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (userRes.rows.length === 0) return null;
    const u = userRes.rows[0];
    const historyRes = await query('SELECT * FROM view_history WHERE user_id = $1 ORDER BY viewed_at DESC LIMIT 100', [u.id]);
    const history = historyRes.rows.map(h => ({
      id: h.id,
      mediaId: h.media_id,
      source: h.source,
      deviceName: h.device_name,
      clientIp: h.client_ip,
      viewedAt: new Date(h.viewed_at).toISOString()
    }));
    const user = mapUserFromDb(u, history);
    const sec = enforceSecurityPolicies([user]);
    return sec.users[0];
  } catch (err) {
    return CACHE.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || null;
  }
}

export async function findUserByUsername(username) {
  await ensureDirectories();
  try {
    const userRes = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (userRes.rows.length === 0) return null;
    const u = userRes.rows[0];
    return mapUserFromDb(u);
  } catch (err) {
    return CACHE.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase()) || null;
  }
}

export async function saveUser(userData) {
  await ensureDirectories();
  const sec = enforceSecurityPolicies([userData]);
  const user = sec.users[0];

  try {
    await query(
      `INSERT INTO users (
        id, username, email, password_hash, role, plan, avatar_url, is_2fa_enabled, 
        two_fa_secret, auth_provider, is_google_linked, storage_quota, storage_used, 
        vault_password_hash, settings, filter_preferences, video_progress, sessions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        plan = EXCLUDED.plan,
        avatar_url = EXCLUDED.avatar_url,
        is_2fa_enabled = EXCLUDED.is_2fa_enabled,
        two_fa_secret = EXCLUDED.two_fa_secret,
        auth_provider = EXCLUDED.auth_provider,
        is_google_linked = EXCLUDED.is_google_linked,
        storage_quota = EXCLUDED.storage_quota,
        storage_used = EXCLUDED.storage_used,
        vault_password_hash = EXCLUDED.vault_password_hash,
        settings = EXCLUDED.settings,
        filter_preferences = EXCLUDED.filter_preferences,
        video_progress = EXCLUDED.video_progress,
        sessions = EXCLUDED.sessions,
        updated_at = NOW()`,
      [
        user.id,
        user.username,
        user.email,
        user.passwordHash || 'GOOGLE_OAUTH_USER',
        user.role || 'user',
        user.plan || 'free',
        user.avatarUrl || null,
        !!user.is2FAEnabled,
        user.twoFASecret || null,
        user.authProvider || 'local',
        !!user.isGoogleLinked,
        user.storageQuota || 3221225472,
        user.storageUsed || 0,
        user.vaultPasswordHash || null,
        JSON.stringify(user.settings || {}),
        JSON.stringify(user.filterPreferences || {}),
        JSON.stringify(user.videoProgress || {}),
        JSON.stringify(user.sessions || []),
        user.createdAt ? new Date(user.createdAt) : new Date()
      ]
    );
  } catch (err) {
    console.error('[StorageService] Error guardando usuario en PostgreSQL:', err);
  }

  const idx = CACHE.users.findIndex(u => u.id === user.id);
  if (idx > -1) CACHE.users[idx] = user;
  else CACHE.users.push(user);

  broadcastNeuralEvent('USERS', { userId: user.id });
  return user;
}

export async function recordSession(userId, userAgent = '') {
  await ensureDirectories();
  const newSession = {
    id: Math.random().toString(36).substring(7),
    deviceName: userAgent.includes('Mobile') ? 'Móvil' : 'Escritorio',
    browser: 'PixelSphere Web Client',
    os: 'Node Environment',
    ip: '127.0.0.1',
    lastActive: new Date().toISOString(),
    isCurrent: true
  };

  const user = await findUserById(userId);
  if (!user) return null;

  const sessions = [newSession, ...(user.sessions || []).map(s => ({ ...s, isCurrent: false }))].slice(0, 5);
  user.sessions = sessions;

  try {
    await query('UPDATE users SET sessions = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(sessions), userId]);
  } catch (err) {}

  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx > -1) CACHE.users[idx].sessions = sessions;

  return user;
}

export async function recordMediaView(userId, mediaId, meta = {}) {
  await ensureDirectories();
  const entry = {
    id: Math.random().toString(36).substring(7),
    mediaId,
    viewedAt: new Date().toISOString(),
    source: meta.source || 'Galería Principal',
    deviceName: meta.deviceName || 'Escritorio',
    clientIp: meta.clientIp || '127.0.0.1'
  };

  try {
    await query(
      `INSERT INTO view_history (id, user_id, media_id, source, device_name, client_ip, viewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [entry.id, userId, mediaId, entry.source, entry.deviceName, entry.clientIp]
    );
  } catch (err) {
    console.error('[StorageService] Error al registrar view_history en PostgreSQL:', err);
  }

  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx > -1) {
    const history = CACHE.users[idx].viewHistory || [];
    CACHE.users[idx].viewHistory = [entry, ...history.filter(h => h.mediaId !== mediaId)].slice(0, 100);
  }

  broadcastNeuralEvent('USERS', { userId });
  broadcastNeuralEvent('HISTORY', { userId, entry });
  return CACHE.users.find(u => u.id === userId) || null;
}

export async function clearUserHistory(userId) {
  await ensureDirectories();
  try {
    await query('DELETE FROM view_history WHERE user_id = $1', [userId]);
  } catch (err) {
    console.error('[StorageService] Error eliminando view_history en PostgreSQL:', err);
  }

  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx > -1) CACHE.users[idx].viewHistory = [];

  broadcastNeuralEvent('USERS', { userId });
  broadcastNeuralEvent('HISTORY', { userId, cleared: true });
  return true;
}

export async function updateVideoProgress(userId, mediaId, seconds) {
  await ensureDirectories();
  const user = await findUserById(userId);
  if (!user) return null;

  const progress = user.videoProgress || {};
  progress[mediaId] = seconds;

  try {
    await query('UPDATE users SET video_progress = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(progress), userId]);
  } catch (err) {}

  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx > -1) CACHE.users[idx].videoProgress = progress;

  return CACHE.users[idx] || user;
}

// ==================== MULTIMEDIA ====================

export async function getMedia(options = {}) {
  await ensureDirectories();
  const { isDeleted = false, userId = null } = (typeof options === 'object' && options !== null) ? options : {};
  try {
    let sql = 'SELECT * FROM media WHERE 1=1';
    const params = [];
    if (isDeleted !== 'all') {
      params.push(isDeleted);
      sql += ` AND is_deleted = $${params.length}`;
    }
    if (userId && userId !== 'all') {
      params.push(userId);
      sql += ` AND user_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);
    const mapped = res.rows.map(mapMediaFromDb);
    if ((!userId || userId === 'all') && isDeleted === false) {
      CACHE.media = mapped;
    }
    return mapped;
  } catch (err) {
    console.warn('[StorageService] Fallo consultando media de PostgreSQL, usando caché:', err.message);
    return CACHE.media.filter(m => (isDeleted === 'all' || !!m.isDeleted === isDeleted) && (!userId || userId === 'all' || m.userId === userId));
  }
}

export async function getMediaByUser(userId, includeDeleted = false) {
  await ensureDirectories();
  try {
    const sql = includeDeleted
      ? 'SELECT * FROM media WHERE user_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM media WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC';
    const res = await query(sql, [userId]);
    return res.rows.map(mapMediaFromDb);
  } catch (err) {
    return CACHE.media.filter(m => m.userId === userId && (includeDeleted || !m.isDeleted));
  }
}

export async function getDeletedMedia(userId) {
  await ensureDirectories();
  try {
    let sql = 'SELECT * FROM media WHERE is_deleted = true';
    const params = [];
    if (userId && userId !== 'all') {
      params.push(userId);
      sql += ' AND user_id = $1';
    }
    sql += ' ORDER BY deleted_at DESC NULLS LAST, created_at DESC';
    const res = await query(sql, params);
    return res.rows.map(mapMediaFromDb);
  } catch (err) {
    console.warn('[StorageService] Fallo consultando papelera en PostgreSQL, usando caché:', err.message);
    return CACHE.media.filter(m => (!userId || userId === 'all' || m.userId === userId) && m.isDeleted);
  }
}

export async function findMediaById(id) {
  await ensureDirectories();
  try {
    const res = await query('SELECT * FROM media WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapMediaFromDb(res.rows[0]);
  } catch (err) {
    return CACHE.media.find(m => m.id === id) || null;
  }
}

export async function saveMediaMetadata(entry) {
  await ensureDirectories();
  try {
    await query(
      `INSERT INTO media (
        id, user_id, filename, original_name, mime_type, type, size, url, thumbnail_url,
        width, height, duration, is_adult_content, nsfw_score, tags, visual_tags, description,
        album_id, album_ids, shared_with, is_shared, is_deleted, deleted_at, source, camera,
        file_hash, cloud_storage_path, cloud_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW())
      ON CONFLICT (id) DO UPDATE SET
        filename = EXCLUDED.filename,
        tags = EXCLUDED.tags,
        visual_tags = EXCLUDED.visual_tags,
        description = EXCLUDED.description,
        album_id = EXCLUDED.album_id,
        album_ids = EXCLUDED.album_ids,
        shared_with = EXCLUDED.shared_with,
        is_adult_content = EXCLUDED.is_adult_content,
        is_deleted = EXCLUDED.is_deleted,
        deleted_at = EXCLUDED.deleted_at,
        file_hash = COALESCE(EXCLUDED.file_hash, media.file_hash),
        cloud_storage_path = COALESCE(EXCLUDED.cloud_storage_path, media.cloud_storage_path),
        cloud_url = COALESCE(EXCLUDED.cloud_url, media.cloud_url),
        updated_at = NOW()`,
      [
        entry.id,
        entry.userId,
        entry.filename,
        entry.originalName || entry.filename,
        entry.mimeType || 'image/png',
        entry.type || 'image',
        entry.size || 0,
        entry.url,
        entry.thumbnailUrl || entry.url,
        entry.width || null,
        entry.height || null,
        entry.duration || null,
        !!entry.isAdultContent,
        entry.nsfwScore || 0,
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry.visualTags || []),
        entry.description || null,
        entry.albumId || null,
        JSON.stringify(entry.albumIds || []),
        JSON.stringify(entry.sharedWith || []),
        !!entry.isShared,
        !!entry.isDeleted,
        entry.deletedAt ? new Date(entry.deletedAt) : null,
        entry.source || null,
        entry.camera || null,
        entry.fileHash || null,
        entry.cloudStoragePath || entry.storagePath || null,
        entry.cloudUrl || entry.downloadUrl || null,
        entry.createdAt ? new Date(entry.createdAt) : new Date()
      ]
    );

    // Actualizar storage_used del usuario en la base de datos
    await recalculateUserStorage(entry.userId);
  } catch (err) {
    console.error('[StorageService] Error guardando media en PostgreSQL:', err);
  }

  const idx = CACHE.media.findIndex(m => m.id === entry.id);
  if (idx > -1) CACHE.media[idx] = entry;
  else CACHE.media.unshift(entry);

  // Sincronizar álbumes asociados
  const targetAlbumIds = Array.from(new Set([
    ...(entry.albumId ? [entry.albumId] : []),
    ...(Array.isArray(entry.albumIds) ? entry.albumIds : [])
  ]));

  if (targetAlbumIds.length > 0) {
    for (const albId of targetAlbumIds) {
      await query(
        `UPDATE albums SET 
          media_ids = CASE 
            WHEN NOT media_ids @> $1::jsonb THEN media_ids || $1::jsonb 
            ELSE media_ids 
          END,
          updated_at = NOW()
        WHERE id = $2`,
        [JSON.stringify([entry.id]), albId]
      ).catch(() => {});
    }
  }

  broadcastNeuralEvent('MEDIA', { userId: entry.userId, mediaId: entry.id });
  return entry;
}

export async function updateMedia(id, uid, updates) {
  await ensureDirectories();
  const current = await findMediaById(id);
  if (!current) return null;

  const merged = { ...current, ...updates };

  try {
    await query(
      `UPDATE media SET 
        filename = COALESCE($1, filename),
        tags = COALESCE($2::jsonb, tags),
        visual_tags = COALESCE($3::jsonb, visual_tags),
        description = COALESCE($4, description),
        album_id = $5,
        album_ids = COALESCE($6::jsonb, album_ids),
        shared_with = COALESCE($7::jsonb, shared_with),
        is_adult_content = COALESCE($8, is_adult_content),
        is_deleted = COALESCE($9, is_deleted),
        deleted_at = $10,
        updated_at = NOW()
      WHERE id = $11`,
      [
        updates.filename || null,
        updates.tags ? JSON.stringify(updates.tags) : null,
        updates.visualTags ? JSON.stringify(updates.visualTags) : null,
        updates.description !== undefined ? updates.description : null,
        updates.albumId !== undefined ? updates.albumId : current.albumId,
        updates.albumIds ? JSON.stringify(updates.albumIds) : null,
        updates.sharedWith ? JSON.stringify(updates.sharedWith) : null,
        updates.isAdultContent !== undefined ? updates.isAdultContent : null,
        updates.isDeleted !== undefined ? updates.isDeleted : null,
        updates.deletedAt ? new Date(updates.deletedAt) : null,
        id
      ]
    );
  } catch (err) {
    console.error('[StorageService] Error actualizando media en PostgreSQL:', err);
  }

  const idx = CACHE.media.findIndex(m => m.id === id);
  if (idx > -1) CACHE.media[idx] = merged;

  broadcastNeuralEvent('MEDIA', { userId: uid || current.userId, mediaId: id });
  return merged;
}

export async function updateMultipleMedia(ids, uid, updates) {
  await ensureDirectories();
  for (const id of ids) {
    await updateMedia(id, uid, updates);
  }
  return true;
}

export async function deleteMedia(id, uid, permanent = false) {
  await ensureDirectories();
  const current = await findMediaById(id);
  if (!current) return false;
  if (uid && uid !== 'all' && uid !== 'admin' && uid !== 'default_user' && current.userId && current.userId !== uid) {
    const userObj = CACHE.users.find(u => u.id === uid);
    if (!userObj || userObj.role !== 'admin') {
      console.warn(`[StorageService] Intento no autorizado de eliminar ${id} por usuario ${uid}`);
      return false;
    }
  }

  const isPermanentDelete = permanent || !!current.isDeleted;
  const ownerId = current.userId || uid;

  try {
    if (isPermanentDelete) {
      console.log(`[StorageService] Eliminando DEFINITIVAMENTE medio ${id} (${current.filename}) de PostgreSQL y Firebase Storage`);

      // 1. Eliminar directamente en PostgreSQL
      await query('DELETE FROM media WHERE id = $1', [id]);
      await query('DELETE FROM view_history WHERE media_id = $1', [id]).catch(() => {});

      // 2. Eliminar de Firebase Storage (Zero-Knowledge y variantes)
      const cloudPathsToDelete = new Set();
      if (current.cloudStoragePath) {
        cloudPathsToDelete.add(current.cloudStoragePath);
      }
      if (current.url) {
        const baseName = path.basename(current.url);
        cloudPathsToDelete.add(`media/${ownerId}/${current.type || 'image'}/${baseName}.enc`);
        cloudPathsToDelete.add(`media/${ownerId}/${current.type || 'image'}/${baseName}`);
        if (current.userId && current.userId !== ownerId) {
          cloudPathsToDelete.add(`media/${current.userId}/${current.type || 'image'}/${baseName}.enc`);
          cloudPathsToDelete.add(`media/${current.userId}/${current.type || 'image'}/${baseName}`);
        }
      }
      if (current.thumbnailUrl) {
        const thumbName = path.basename(current.thumbnailUrl);
        cloudPathsToDelete.add(`thumbnails/${ownerId}/${thumbName}.enc`);
        cloudPathsToDelete.add(`thumbnails/${ownerId}/${thumbName}`);
        if (current.userId && current.userId !== ownerId) {
          cloudPathsToDelete.add(`thumbnails/${current.userId}/${thumbName}.enc`);
          cloudPathsToDelete.add(`thumbnails/${current.userId}/${thumbName}`);
        }
      }

      for (const p of cloudPathsToDelete) {
        try {
          await deleteFromCloudStorage(p);
        } catch (e) {
          console.warn(`[StorageService] Error eliminando ${p} de Firebase:`, e.message);
        }
      }

      // Eliminar de caché en memoria
      CACHE.media = CACHE.media.filter(m => m.id !== id);
    } else {
      // Mover a papelera (soft delete)
      console.log(`[StorageService] Moviendo a papelera medio ${id} (${current.filename})`);
      await query('UPDATE media SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
      const idx = CACHE.media.findIndex(m => m.id === id);
      if (idx > -1) {
        CACHE.media[idx].isDeleted = true;
        CACHE.media[idx].deletedAt = new Date().toISOString();
      }
    }
  } catch (err) {
    console.error('[StorageService] Error eliminando media en PostgreSQL:', err);
    return false;
  }

  if (ownerId) {
    await recalculateUserStorage(ownerId);
  }
  broadcastNeuralEvent('MEDIA', { userId: ownerId, deletedId: id, permanent: isPermanentDelete });
  return true;
}

export async function deleteMultipleMedia(ids, uid, permanent = false) {
  await ensureDirectories();
  if (!Array.isArray(ids) || ids.length === 0) return true;
  for (const id of ids) {
    await deleteMedia(id, uid, permanent);
  }
  return true;
}

export async function emptyTrash(uid) {
  await ensureDirectories();
  try {
    let sql = 'SELECT id, user_id FROM media WHERE is_deleted = true';
    const params = [];
    if (uid && uid !== 'all' && uid !== 'admin') {
      params.push(uid);
      sql += ' AND user_id = $1';
    }
    const res = await query(sql, params);
    for (const row of res.rows) {
      await deleteMedia(row.id, row.user_id || uid, true);
    }
    return true;
  } catch (err) {
    console.error('[StorageService] Error vaciando papelera:', err);
    return false;
  }
}

export async function cleanupExpiredTrash(days = 30) {
  await ensureDirectories();
  try {
    const res = await query(
      `SELECT * FROM media 
       WHERE is_deleted = true 
         AND deleted_at IS NOT NULL 
         AND deleted_at < NOW() - ($1 || ' days')::INTERVAL`,
      [days]
    );

    if (res.rows.length === 0) {
      return { count: 0, purgedIds: [] };
    }

    console.log(`[StorageService] 🧹 Ejecutando purga automática de ${res.rows.length} elementos expirados (> ${days} días)...`);
    const purgedIds = [];

    for (const row of res.rows) {
      const item = mapMediaFromDb(row);
      console.log(`[StorageService] Purgando definitivamente por expiración de 30 días: ${item.id} (${item.filename})`);
      await deleteMedia(item.id, item.userId, true);
      purgedIds.push(item.id);
    }

    console.log(`[StorageService] ✅ Purga de 30 días completada: ${purgedIds.length} elementos eliminados de PostgreSQL y Firebase Storage.`);
    return { count: purgedIds.length, purgedIds };
  } catch (err) {
    console.error('[StorageService] Error en purga automática de 30 días:', err);
    return { count: 0, error: err.message };
  }
}

export async function restoreMultipleMedia(ids, uid) {
  await ensureDirectories();
  try {
    if (uid && uid !== 'all' && uid !== 'admin') {
      await query(
        'UPDATE media SET is_deleted = false, deleted_at = NULL, updated_at = NOW() WHERE id = ANY($1) AND user_id = $2',
        [ids, uid]
      );
    } else {
      await query(
        'UPDATE media SET is_deleted = false, deleted_at = NULL, updated_at = NOW() WHERE id = ANY($1)',
        [ids]
      );
    }
  } catch (err) {
    console.error('[StorageService] Error restaurando media en PostgreSQL:', err);
  }

  const set = new Set(ids);
  CACHE.media = CACHE.media.map(m => {
    if ((!uid || uid === 'all' || uid === 'admin' || m.userId === uid) && set.has(m.id)) {
      return { ...m, isDeleted: false, deletedAt: null };
    }
    return m;
  });

  if (uid && uid !== 'all' && uid !== 'admin') {
    await recalculateUserStorage(uid);
  }
  broadcastNeuralEvent('MEDIA', { userId: uid });
  return true;
}

// ==================== ÁLBUMES ====================

export async function getAlbums() {
  await ensureDirectories();
  try {
    const res = await query('SELECT * FROM albums ORDER BY created_at DESC');
    CACHE.albums = res.rows.map(mapAlbumFromDb);
  } catch (err) {
    console.warn('[StorageService] Fallo consultando albums de PostgreSQL:', err.message);
  }
  return CACHE.albums;
}

export async function getAlbumsByUser(uid) {
  await ensureDirectories();
  try {
    const res = await query('SELECT * FROM albums WHERE user_id = $1 ORDER BY created_at DESC', [uid]);
    return res.rows.map(mapAlbumFromDb);
  } catch (err) {
    return CACHE.albums.filter(a => a.userId === uid);
  }
}

export async function createAlbum(albumData) {
  await ensureDirectories();
  try {
    await query(
      `INSERT INTO albums (id, user_id, title, description, parent_id, cover_media_id, is_public, shared_with, media_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        parent_id = EXCLUDED.parent_id,
        cover_media_id = EXCLUDED.cover_media_id,
        is_public = EXCLUDED.is_public,
        shared_with = EXCLUDED.shared_with,
        media_ids = EXCLUDED.media_ids,
        updated_at = NOW()`,
      [
        albumData.id,
        albumData.userId,
        albumData.title,
        albumData.description || null,
        albumData.parentId || null,
        albumData.coverMediaId || null,
        !!albumData.isPublic,
        JSON.stringify(albumData.sharedWith || []),
        JSON.stringify(albumData.mediaIds || [])
      ]
    );
  } catch (err) {
    console.error('[StorageService] Error guardando album en PostgreSQL:', err);
  }

  CACHE.albums = CACHE.albums.filter(a => a.id !== albumData.id);
  CACHE.albums.unshift(albumData);

  broadcastNeuralEvent('ALBUMS', { userId: albumData.userId, albumId: albumData.id });
  return albumData;
}

export async function updateAlbum(id, uid, updates) {
  await ensureDirectories();
  let current = CACHE.albums.find(a => a.id === id);
  if (!current) {
    try {
      const res = await query('SELECT * FROM albums WHERE id = $1', [id]);
      if (res.rows.length > 0) current = mapAlbumFromDb(res.rows[0]);
    } catch (e) {}
  }
  if (!current) return null;

  const merged = { ...current, ...updates };

  try {
    await query(
      `UPDATE albums SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        parent_id = $3,
        cover_media_id = $4,
        is_public = COALESCE($5, is_public),
        shared_with = COALESCE($6::jsonb, shared_with),
        media_ids = COALESCE($7::jsonb, media_ids),
        updated_at = NOW()
      WHERE id = $8`,
      [
        updates.title || null,
        updates.description !== undefined ? updates.description : null,
        updates.parentId !== undefined ? updates.parentId : current.parentId,
        updates.coverMediaId !== undefined ? updates.coverMediaId : current.coverMediaId,
        updates.isPublic !== undefined ? updates.isPublic : null,
        updates.sharedWith ? JSON.stringify(updates.sharedWith) : null,
        updates.mediaIds ? JSON.stringify(updates.mediaIds) : null,
        id
      ]
    );
  } catch (err) {
    console.error('[StorageService] Error actualizando album en PostgreSQL:', err);
  }

  const idx = CACHE.albums.findIndex(a => a.id === id);
  if (idx > -1) CACHE.albums[idx] = merged;
  else CACHE.albums.unshift(merged);

  broadcastNeuralEvent('ALBUMS', { userId: uid || current.userId, albumId: id });
  return merged;
}

export async function deleteAlbum(id, uid) {
  await ensureDirectories();
  const all = await getAlbums();
  const toDel = new Set([id]);
  const findChildren = (pid) => {
    all.filter(a => a.parentId === pid).forEach(c => {
      toDel.add(c.id);
      findChildren(c.id);
    });
  };
  findChildren(id);

  const idsArray = Array.from(toDel);

  try {
    await query('DELETE FROM albums WHERE id = ANY($1)', [idsArray]);
  } catch (err) {
    console.error('[StorageService] Error eliminando album en PostgreSQL:', err);
  }

  CACHE.albums = CACHE.albums.filter(a => !toDel.has(a.id));

  broadcastNeuralEvent('ALBUMS', { userId: uid });
  return idsArray;
}

// ==================== LOGROS ====================

export async function getAchievementsByUser(uid) {
  await ensureDirectories();
  try {
    const res = await query('SELECT * FROM achievements WHERE user_id = $1 ORDER BY unlocked_at DESC', [uid]);
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      badgeId: r.badge_id,
      unlockedAt: new Date(r.unlocked_at).toISOString()
    }));
  } catch (err) {
    return CACHE.achievements.filter(a => a.userId === uid);
  }
}

export async function unlockAchievement(uid, bid) {
  await ensureDirectories();
  const newAch = {
    id: Math.random().toString(36).substring(7),
    userId: uid,
    badgeId: bid,
    unlockedAt: new Date().toISOString()
  };

  try {
    await query(
      `INSERT INTO achievements (id, user_id, badge_id, unlocked_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, badge_id) DO NOTHING`,
      [newAch.id, uid, bid]
    );
  } catch (err) {
    console.error('[StorageService] Error guardando logro en PostgreSQL:', err);
  }

  if (!CACHE.achievements.some(a => a.userId === uid && a.badgeId === bid)) {
    CACHE.achievements.push(newAch);
  }

  broadcastNeuralEvent('ACHIEVEMENTS', { userId: uid, badgeId: bid });
  return true;
}

// ==================== MÉTRICAS DE ADMINISTRACIÓN ====================

export async function getAdminMetrics() {
  await ensureDirectories();
  
  let mediaSize = 0;
  let totalUsers = CACHE.users.length;
  let totalMedia = CACHE.media.length;

  try {
    const mediaStatsRes = await query('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM media WHERE is_deleted = false');
    const userStatsRes = await query('SELECT COUNT(*) as count FROM users');
    mediaSize = parseInt(mediaStatsRes.rows[0].total_size, 10) || 0;
    totalMedia = parseInt(mediaStatsRes.rows[0].count, 10) || 0;
    totalUsers = parseInt(userStatsRes.rows[0].count, 10) || 0;
  } catch (err) {
    mediaSize = CACHE.media.reduce((acc, m) => acc + (m.size || 0), 0);
  }

  let databaseSize = 10 * 1024 * 1024;
  try {
    const dbSizeRes = await query('SELECT pg_database_size(current_database()) as dbsize');
    databaseSize = parseInt(dbSizeRes.rows[0].dbsize, 10) || databaseSize;
  } catch (e) {}
  const projectBaseSize = 150 * 1024 * 1024;

  const usersStats = CACHE.users.map(u => {
    const userMedia = CACHE.media.filter(m => m.userId === u.id);
    const userAlbums = CACHE.albums.filter(a => a.userId === u.id);
    const size = userMedia.reduce((acc, m) => acc + (m.size || 0), 0);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role || 'user',
      mediaCount: userMedia.length,
      albumCount: userAlbums.length,
      storageUsed: size,
      createdAt: u.createdAt,
      viewHistory: u.viewHistory || []
    };
  });

  return {
    multimediaSize: mediaSize,
    databaseSize,
    projectBaseSize,
    totalSystemSize: mediaSize + databaseSize + projectBaseSize,
    userCount: totalUsers,
    mediaCount: totalMedia,
    usersStats
  };
}

export async function recalculateUserStorage(userId) {
  if (!userId) return;
  try {
    const res = await query(
      `UPDATE users 
       SET storage_used = COALESCE(
         (SELECT SUM(size) FROM media WHERE user_id = $1 AND is_deleted = false), 
         0
       )
       WHERE id = $1
       RETURNING storage_used, storage_quota, plan`,
      [userId]
    );
    if (res.rows[0]) {
      const u = CACHE.users.find(usr => usr.id === userId);
      if (u) {
        u.storageUsed = parseInt(res.rows[0].storage_used, 10);
        u.storageQuota = parseInt(res.rows[0].storage_quota, 10);
        u.plan = res.rows[0].plan || 'free';
      }
    }
  } catch (e) {
    console.warn('[StorageService] Error recalculando storage_used:', e.message);
  }
}

export async function checkUserStorageQuota(userId, incomingBytes = 0) {
  if (!userId) return { allowed: true, quota: 3221225472, used: 0, plan: 'free' };
  try {
    const res = await query(
      `SELECT storage_quota, storage_used, plan, role FROM users WHERE id = $1`,
      [userId]
    );
    if (res.rows[0]) {
      const quota = parseInt(res.rows[0].storage_quota, 10) || 3221225472;
      const used = parseInt(res.rows[0].storage_used, 10) || 0;
      const plan = res.rows[0].plan || 'free';
      const role = res.rows[0].role || 'user';

      if (role === 'admin') {
        return { allowed: true, quota, used, plan, role, available: Math.max(0, quota - used) };
      }

      if (used + incomingBytes > quota) {
        return {
          allowed: false,
          quota,
          used,
          plan,
          available: Math.max(0, quota - used),
          needed: incomingBytes
        };
      }
      return { allowed: true, quota, used, plan, available: quota - used };
    }
  } catch (err) {
    console.warn('[StorageService] Error comprobando cuota:', err.message);
  }
  return { allowed: true, quota: 3221225472, used: 0, plan: 'free' };
}

export async function findMediaByHash(userId, fileHash) {
  if (!userId || !fileHash) return null;
  try {
    const res = await query(
      `SELECT * FROM media WHERE user_id = $1 AND file_hash = $2 AND is_deleted = false LIMIT 1`,
      [userId, fileHash]
    );
    if (res.rows[0]) {
      return mapMediaFromDb(res.rows[0]);
    }
  } catch (e) {
    console.warn('[StorageService] Error buscando media por hash:', e.message);
  }
  return null;
}

