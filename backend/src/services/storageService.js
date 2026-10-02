import fs from 'node:fs/promises';
import path from 'node:path';
import { FILE_PATHS, DATA_DIR, UPLOADS_DIR } from '../config/constants.js';
import { broadcastNeuralEvent } from './eventService.js';

/**
 * PIXELSPHERE STORAGE SERVICE v50.0 (Node.js Puro)
 * Persistencia atómica de RAM y disco mediante archivos JSON.
 */

const CACHE = {
  users: [],
  media: [],
  albums: [],
  achievements: [],
  isInitialized: false
};

let diskWritePromise = Promise.resolve();

function enforceSecurityPolicies(users) {
  let changed = false;
  const nextUsers = users.map(user => {
    const isMainAdmin = user.id === '6k7ddznwz' || user.email === 'andresksa123@gmail.com';
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

async function syncToDisk(type) {
  diskWritePromise = diskWritePromise.then(async () => {
    try {
      const filePath = FILE_PATHS[type.toUpperCase()];
      if (!filePath) return;
      
      if (type === 'users') {
        const result = enforceSecurityPolicies(CACHE.users);
        CACHE.users = result.users;
      }

      const data = JSON.stringify(CACHE[type], null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (err) {
      console.error(`[StorageService] Error en persistencia: ${type}`, err);
    }
  }).catch((err) => {
    console.error('[StorageService] Error en cadena de persistencia:', err);
    diskWritePromise = Promise.resolve();
  });
  return diskWritePromise;
}

let initPromise = null;
export async function ensureDirectories() {
  if (CACHE.isInitialized) {
    const result = enforceSecurityPolicies(CACHE.users);
    if (result.changed) {
      CACHE.users = result.users;
      await syncToDisk('users');
    }
    return;
  }
  
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    
    const entities = ['users', 'media', 'albums', 'achievements'];
    for (const entity of entities) {
      const filePath = FILE_PATHS[entity.toUpperCase()];
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        CACHE[entity] = JSON.parse(data || '[]');
      } catch (err) {
        console.warn(`[StorageService] Inicializando ${filePath} como arreglo vacío.`);
        await fs.writeFile(filePath, '[]');
        CACHE[entity] = [];
      }
    }

    const result = enforceSecurityPolicies(CACHE.users);
    CACHE.users = result.users;
    await syncToDisk('users');

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
  return CACHE.users.find(u => u.id === id) || null;
}

export async function findUserByEmail(email) {
  await ensureDirectories();
  const user = CACHE.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (user) {
    const result = enforceSecurityPolicies([user]);
    if (result.changed) {
      const idx = CACHE.users.findIndex(u => u.id === user.id);
      CACHE.users[idx] = result.users[0];
      await syncToDisk('users');
      return result.users[0];
    }
  }
  return user || null;
}

export async function saveUser(userData) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userData.id);
  if (idx > -1) {
    CACHE.users[idx] = userData;
  } else {
    CACHE.users.push(userData);
  }
  
  const result = enforceSecurityPolicies(CACHE.users);
  CACHE.users = result.users;
  await syncToDisk('users');
  broadcastNeuralEvent('USERS', { userId: userData.id });
  return CACHE.users.find(u => u.id === userData.id) || userData;
}

export async function recordSession(userId, userAgent = '') {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  const newSession = {
    id: Math.random().toString(36).substring(7),
    deviceName: userAgent.includes('Mobile') ? 'Móvil' : 'Escritorio',
    browser: 'PixelSphere Web Client',
    os: 'Node Environment',
    ip: '127.0.0.1',
    lastActive: new Date().toISOString(),
    isCurrent: true
  };
  CACHE.users[idx].sessions = [newSession, ...(CACHE.users[idx].sessions || []).map(s => ({ ...s, isCurrent: false }))].slice(0, 5);
  await syncToDisk('users');
  return CACHE.users[idx];
}

export async function recordMediaView(userId, mediaId) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return null;

  const history = CACHE.users[idx].viewHistory || [];
  const nextHistory = [
    { mediaId, viewedAt: new Date().toISOString() },
    ...history.filter(h => h.mediaId !== mediaId)
  ].slice(0, 100);

  CACHE.users[idx].viewHistory = nextHistory;
  await syncToDisk('users');
  return CACHE.users[idx];
}

export async function updateVideoProgress(userId, mediaId, seconds) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return null;

  const progress = CACHE.users[idx].videoProgress || {};
  progress[mediaId] = seconds;

  CACHE.users[idx].videoProgress = progress;
  await syncToDisk('users');
  return CACHE.users[idx];
}

// ==================== MULTIMEDIA ====================

export async function getMedia() {
  await ensureDirectories();
  return CACHE.media;
}

export async function getMediaByUser(userId) {
  await ensureDirectories();
  return CACHE.media.filter(m => m.userId === userId);
}

export async function findMediaById(id) {
  await ensureDirectories();
  return CACHE.media.find(m => m.id === id) || null;
}

export async function saveMediaMetadata(entry) {
  await ensureDirectories();
  const exists = CACHE.media.findIndex(m => m.id === entry.id);
  if (exists > -1) {
    CACHE.media[exists] = entry;
  } else {
    CACHE.media.push(entry);
  }
  await syncToDisk('media');
  broadcastNeuralEvent('MEDIA', { userId: entry.userId, mediaId: entry.id });
  return entry;
}

export async function updateMedia(id, uid, updates) {
  await ensureDirectories();
  const idx = CACHE.media.findIndex(m => m.id === id && m.userId === uid);
  if (idx === -1) return null;
  CACHE.media[idx] = { ...CACHE.media[idx], ...updates };
  await syncToDisk('media');
  broadcastNeuralEvent('MEDIA', { userId: uid, mediaId: id });
  return CACHE.media[idx];
}

export async function updateMultipleMedia(ids, uid, updates) {
  await ensureDirectories();
  const set = new Set(ids);
  let changed = false;
  CACHE.media = CACHE.media.map(m => {
    if (m.userId === uid && set.has(m.id)) {
      changed = true;
      return { ...m, ...updates };
    }
    return m;
  });
  if (changed) {
    await syncToDisk('media');
    broadcastNeuralEvent('MEDIA', { userId: uid });
  }
  return changed;
}

export async function deleteMedia(id, uid) {
  await ensureDirectories();
  const idx = CACHE.media.findIndex(m => m.id === id && m.userId === uid);
  if (idx === -1) return false;
  if (CACHE.media[idx].isDeleted) {
    CACHE.media.splice(idx, 1);
  } else {
    CACHE.media[idx] = { ...CACHE.media[idx], isDeleted: true, deletedAt: new Date().toISOString() };
  }
  await syncToDisk('media');
  broadcastNeuralEvent('MEDIA', { userId: uid });
  return true;
}

export async function deleteMultipleMedia(ids, uid) {
  await ensureDirectories();
  const set = new Set(ids);
  let changed = false;
  const nextMedia = CACHE.media.filter(m => {
    if (m.userId === uid && set.has(m.id)) {
      changed = true;
      if (m.isDeleted) return false;
      m.isDeleted = true;
      m.deletedAt = new Date().toISOString();
    }
    return true;
  });
  if (changed) {
    CACHE.media = nextMedia;
    await syncToDisk('media');
    broadcastNeuralEvent('MEDIA', { userId: uid });
  }
  return changed;
}

export async function restoreMultipleMedia(ids, uid) {
  await ensureDirectories();
  const set = new Set(ids);
  let changed = false;
  CACHE.media = CACHE.media.map(m => {
    if (m.userId === uid && set.has(m.id)) {
      changed = true;
      return { ...m, isDeleted: false, deletedAt: undefined };
    }
    return m;
  });
  if (changed) {
    await syncToDisk('media');
    broadcastNeuralEvent('MEDIA', { userId: uid });
  }
  return changed;
}

// ==================== ÁLBUMES ====================

export async function getAlbums() {
  await ensureDirectories();
  return CACHE.albums;
}

export async function getAlbumsByUser(uid) {
  await ensureDirectories();
  return CACHE.albums.filter(a => a.userId === uid);
}

export async function createAlbum(albumData) {
  await ensureDirectories();
  CACHE.albums.push(albumData);
  await syncToDisk('albums');
  broadcastNeuralEvent('ALBUMS', { userId: albumData.userId });
  return albumData;
}

export async function updateAlbum(id, uid, updates) {
  await ensureDirectories();
  const idx = CACHE.albums.findIndex(a => a.id === id && a.userId === uid);
  if (idx === -1) return null;
  CACHE.albums[idx] = { ...CACHE.albums[idx], ...updates };
  await syncToDisk('albums');
  broadcastNeuralEvent('ALBUMS', { userId: uid });
  return CACHE.albums[idx];
}

export async function deleteAlbum(id, uid) {
  await ensureDirectories();
  const toDel = new Set([id]);
  const findChildren = (pid) => {
    CACHE.albums.filter(a => a.parentId === pid).forEach(c => {
      toDel.add(c.id);
      findChildren(c.id);
    });
  };
  findChildren(id);
  CACHE.albums = CACHE.albums.filter(a => !(a.userId === uid && toDel.has(a.id)));
  await syncToDisk('albums');
  broadcastNeuralEvent('ALBUMS', { userId: uid });
  return Array.from(toDel);
}

// ==================== LOGROS ====================

export async function getAchievementsByUser(uid) {
  await ensureDirectories();
  return CACHE.achievements.filter(a => a.userId === uid);
}

export async function unlockAchievement(uid, bid) {
  await ensureDirectories();
  if (CACHE.achievements.some(a => a.userId === uid && a.badgeId === bid)) return false;
  CACHE.achievements.push({
    id: Math.random().toString(36).substring(7),
    userId: uid,
    badgeId: bid,
    unlockedAt: new Date().toISOString()
  });
  await syncToDisk('achievements');
  broadcastNeuralEvent('ACHIEVEMENTS', { userId: uid, badgeId: bid });
  return true;
}

// ==================== MÉTRICAS DE ADMINISTRACIÓN ====================

export async function getAdminMetrics() {
  await ensureDirectories();
  const multimediaSize = CACHE.media.reduce((acc, m) => acc + (m.size || 0), 0);
  const databaseSize = JSON.stringify(CACHE).length;
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
      createdAt: u.createdAt
    };
  });

  return {
    multimediaSize,
    databaseSize,
    projectBaseSize,
    totalSystemSize: multimediaSize + databaseSize + projectBaseSize,
    userCount: CACHE.users.length,
    mediaCount: CACHE.media.length,
    usersStats
  };
}
