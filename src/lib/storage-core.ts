import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { authenticator } from 'otplib';
import { User, Media, Achievement, Album, Session, ViewHistoryEntry } from './types';
import { FILE_PATHS, DATA_DIR, UPLOADS_DIR } from './storage-constants';
import { emitNeuralUpdate } from './neural-events';

/**
 * PIXELSPHERE CORE v49.0 - PROTOCOLO DE CONTINUIDAD ATÓMICA
 * Gestión de RAM persistente, blindaje de roles y purga forzada de 2FA.
 */

const ENCRYPTION_KEY = Buffer.from('f36e82671573282b12da05b1e195a0d585820bb105a218056eb30119105a2185', 'hex');
const IV_LENGTH = 16;

interface GlobalCache {
  users: User[];
  media: Media[];
  albums: Album[];
  achievements: Achievement[];
  isInitialized: boolean;
}

const globalForStorage = global as unknown as { 
  storageCache: GlobalCache;
  initPromise: Promise<void> | null;
};

export const CACHE = globalForStorage.storageCache || {
  users: [],
  media: [],
  albums: [],
  achievements: [],
  isInitialized: false
};

if (process.env.NODE_ENV !== 'production') globalForStorage.storageCache = CACHE;

let diskWritePromise: Promise<void> = Promise.resolve();

/**
 * PROTOCOLO DE BLINDAJE DE NÚCLEO
 * Asegura roles de admin y desactiva 2FA de emergencia para AndRoy con persistencia atómica.
 */
function enforceSecurityPolicies(users: User[]): { users: User[], changed: boolean } {
  let changed = false;
  const nextUsers = users.map(user => {
    const isMainAdmin = user.id === '6k7ddznwz' || user.email === 'andresksa123@gmail.com';
    const targetRole = isMainAdmin ? 'admin' : (user.role || 'user');
    
    let updatedUser = { ...user };
    
    // Forzar Rol
    if (user.role !== targetRole) {
      updatedUser.role = targetRole;
      changed = true;
    }

    // DESACTIVACIÓN DE EMERGENCIA: 2FA para el administrador principal
    if (isMainAdmin && (user.is2FAEnabled || user.twoFASecret)) {
      updatedUser.is2FAEnabled = false;
      delete updatedUser.twoFASecret;
      changed = true;
    }

    return updatedUser;
  });

  return { users: nextUsers, changed };
}

async function syncToDisk(type: keyof Omit<GlobalCache, 'isInitialized'>) {
  diskWritePromise = diskWritePromise.then(async () => {
    try {
      const filePath = FILE_PATHS[type.toUpperCase() as keyof typeof FILE_PATHS];
      
      if (type === 'users') {
        const result = enforceSecurityPolicies(CACHE.users);
        CACHE.users = result.users;
      }

      const data = JSON.stringify(CACHE[type], null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (err) {
      console.error(`[Nexo Neural] Error en persistencia: ${type}`, err);
    }
  }).catch((err) => {
    console.error('[Nexo Neural] Error en cadena de persistencia en disco:', err);
    diskWritePromise = Promise.resolve();
  });
}

export async function ensureDirectories() {
  if (CACHE.isInitialized) {
    const result = enforceSecurityPolicies(CACHE.users);
    if (result.changed) {
      CACHE.users = result.users;
      await syncToDisk('users');
    }
    return;
  }
  
  if (globalForStorage.initPromise) return globalForStorage.initPromise;

  globalForStorage.initPromise = (async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    
    const entities = ['users', 'media', 'albums', 'achievements'] as const;
    for (const entity of entities) {
      const filePath = FILE_PATHS[entity.toUpperCase() as keyof typeof FILE_PATHS];
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        CACHE[entity] = JSON.parse(data || '[]');
      } catch (err) {
        console.error(`[Nexo Neural] No se pudo leer o parsear ${filePath}, inicializando vacío:`, err);
        await fs.writeFile(filePath, '[]');
        CACHE[entity] = [];
      }
    }

    const result = enforceSecurityPolicies(CACHE.users);
    CACHE.users = result.users;
    await syncToDisk('users');

    CACHE.isInitialized = true;
  })();

  return globalForStorage.initPromise;
}

// --- SEGURIDAD ---
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Error al desencriptar texto:", error);
    return "";
  }
}

export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha512').update(password.trim()).digest('hex');
}

// --- USUARIOS ---
export async function getUsers() { await ensureDirectories(); return CACHE.users; }
export async function findUserByEmail(email: string) { 
  await ensureDirectories(); 
  const user = CACHE.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    const result = enforceSecurityPolicies([user]);
    if (result.changed) {
      const idx = CACHE.users.findIndex(u => u.id === user.id);
      CACHE.users[idx] = result.users[0];
      await syncToDisk('users');
      return result.users[0];
    }
  }
  return user;
}
export async function saveUser(userData: User) {
  await ensureDirectories();
  
  const idx = CACHE.users.findIndex(u => u.id === userData.id);
  if (idx > -1) CACHE.users[idx] = userData; else CACHE.users.push(userData);
  
  const result = enforceSecurityPolicies(CACHE.users);
  CACHE.users = result.users;
  
  await syncToDisk('users');
  emitNeuralUpdate('USERS', { userId: userData.id });
  return CACHE.users.find(u => u.id === userData.id) || userData;
}

export async function recordSession(userId: string, userAgent: string) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  const newSession: Session = {
    id: Math.random().toString(36).substring(7),
    deviceName: userAgent.includes('Mobile') ? 'Móvil' : 'Escritorio',
    browser: 'PixelSphere Browser', os: 'Neural OS', ip: '127.0.0.1',
    lastActive: new Date().toISOString(), isCurrent: true
  };
  CACHE.users[idx].sessions = [newSession, ...(CACHE.users[idx].sessions || []).map(s => ({...s, isCurrent: false}))].slice(0, 5);
  
  const result = enforceSecurityPolicies(CACHE.users);
  CACHE.users = result.users;
  
  await syncToDisk('users');
  return CACHE.users[idx];
}

export async function recordMediaView(userId: string, mediaId: string) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return;

  const history = CACHE.users[idx].viewHistory || [];
  const nextHistory = [
    { mediaId, viewedAt: new Date().toISOString() },
    ...history.filter(h => h.mediaId !== mediaId)
  ].slice(0, 100);

  CACHE.users[idx].viewHistory = nextHistory;
  await syncToDisk('users');
  return CACHE.users[idx];
}

export async function updateVideoProgress(userId: string, mediaId: string, seconds: number) {
  await ensureDirectories();
  const idx = CACHE.users.findIndex(u => u.id === userId);
  if (idx === -1) return;

  const progress = CACHE.users[idx].videoProgress || {};
  progress[mediaId] = seconds;

  CACHE.users[idx].videoProgress = progress;
  await syncToDisk('users');
  return CACHE.users[idx];
}

// --- MULTIMEDIA ---
export async function getMedia() { await ensureDirectories(); return CACHE.media; }
export async function getMediaByUser(userId: string) { 
  await ensureDirectories(); 
  return CACHE.media.filter(m => m.userId === userId); 
}

export async function saveMediaMetadata(entry: Media) {
  await ensureDirectories();
  const exists = CACHE.media.findIndex(m => m.id === entry.id);
  if (exists > -1) CACHE.media[exists] = entry; else CACHE.media.push(entry);
  await syncToDisk('media');
  emitNeuralUpdate('MEDIA', { userId: entry.userId });
  return entry;
}

export async function updateMedia(id: string, uid: string, updates: Partial<Media>) {
  await ensureDirectories();
  const idx = CACHE.media.findIndex(m => m.id === id && m.userId === uid);
  if (idx === -1) return null;
  CACHE.media[idx] = { ...CACHE.media[idx], ...updates };
  await syncToDisk('media');
  emitNeuralUpdate('MEDIA', { userId: uid });
  return CACHE.media[idx];
}

export async function updateMultipleMedia(ids: string[], uid: string, updates: Partial<Media>) {
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
    emitNeuralUpdate('MEDIA', { userId: uid });
  }
  return changed;
}

export async function deleteMedia(id: string, uid: string) {
  await ensureDirectories();
  const idx = CACHE.media.findIndex(m => m.id === id && m.userId === uid);
  if (idx === -1) return false;
  if (CACHE.media[idx].isDeleted) {
    CACHE.media.splice(idx, 1);
  } else {
    CACHE.media[idx] = { ...CACHE.media[idx], isDeleted: true, deletedAt: new Date().toISOString() };
  }
  await syncToDisk('media');
  emitNeuralUpdate('MEDIA', { userId: uid });
  return true;
}

export async function deleteMultipleMedia(ids: string[], uid: string) {
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
    emitNeuralUpdate('MEDIA', { userId: uid });
  }
  return changed;
}

export async function restoreMultipleMedia(ids: string[], uid: string) {
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
    emitNeuralUpdate('MEDIA', { userId: uid });
  }
  return changed;
}

// --- ÁLBUMES ---
export async function getAlbums() { await ensureDirectories(); return CACHE.albums; }
export async function getAlbumsByUser(uid: string) { await ensureDirectories(); return CACHE.albums.filter(a => a.userId === uid); }
export async function createAlbum(a: Album) { 
  await ensureDirectories(); 
  CACHE.albums.push(a); 
  await syncToDisk('albums'); 
  emitNeuralUpdate('ALBUMS', { userId: a.userId }); 
  return a; 
}
export async function updateAlbum(id: string, uid: string, up: Partial<Album>) {
  await ensureDirectories();
  const idx = CACHE.albums.findIndex(a => a.id === id && a.userId === uid);
  if (idx === -1) return null;
  CACHE.albums[idx] = { ...CACHE.albums[idx], ...up };
  await syncToDisk('albums');
  emitNeuralUpdate('ALBUMS', { userId: uid });
  return CACHE.albums[idx];
}
export async function deleteAlbum(id: string, uid: string) {
  await ensureDirectories();
  const toDel = new Set([id]);
  const findChildren = (pid: string) => CACHE.albums.filter(a => a.parentId === pid).forEach(c => { toDel.add(c.id); findChildren(c.id); });
  findChildren(id);
  CACHE.albums = CACHE.albums.filter(a => !(a.userId === uid && toDel.has(a.id)));
  await syncToDisk('albums');
  emitNeuralUpdate('ALBUMS', { userId: uid });
  return Array.from(toDel);
}

// --- LOGROS ---
export async function getAchievementsByUser(uid: string) { await ensureDirectories(); return CACHE.achievements.filter(a => a.userId === uid); }
export async function unlockAchievement(uid: string, bid: string) {
  await ensureDirectories();
  if (CACHE.achievements.some(a => a.userId === uid && a.badgeId === bid)) return false;
  CACHE.achievements.push({ id: Math.random().toString(36).substring(7), userId: uid, badgeId: bid, unlockedAt: new Date().toISOString() });
  await syncToDisk('achievements');
  emitNeuralUpdate('ACHIEVEMENTS', { userId: uid });
  return true;
}

// --- OTROS ---
export async function saveAvatarFile(uid: string, b64: string) {
  const buffer = Buffer.from(b64.split(',')[1], 'base64');
  const name = `av_${uid}_${Date.now()}.jpg`;
  const dir = path.join(UPLOADS_DIR, uid);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return `/uploads/${uid}/${name}`;
}
export async function generate2FASecret(uid: string, e: string) { 
  return { secret: authenticator.generateSecret(), uri: authenticator.keyuri(e, 'PixelSphere', authenticator.generateSecret()) }; 
}
export async function verify2FACode(s: string, c: string) { return authenticator.verify({ token: c, secret: s }); }

export async function clearAllSharedAccess(id: string, uid: string) {
  await ensureDirectories();
  let changed = false;
  const midx = CACHE.media.findIndex(m => m.id === id && m.userId === uid);
  if (midx > -1) { CACHE.media[midx].sharedWith = []; CACHE.media[midx].sharedPermissions = {}; changed = true; }
  const aidx = CACHE.albums.findIndex(a => a.id === id && a.userId === uid);
  if (aidx > -1) { CACHE.albums[aidx].sharedWith = []; CACHE.albums[aidx].isPublic = false; changed = true; }
  if (changed) { await syncToDisk('media'); await syncToDisk('albums'); emitNeuralUpdate('SYSTEM', { userId: uid }); }
  return changed;
}

// --- ADMIN METRICS ---
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
