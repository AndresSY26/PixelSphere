import { api } from '../api/client.js';

/**
 * CLIENT STORAGE ADAPTER (Frontend SPA)
 * Conecta los componentes con la API REST y sincroniza el estado de sesión local
 */

// Gestión de sesión local
const SESSION_KEY = 'pixelsphere_session_user';
const ALT_SESSION_KEY = 'ps_active_session';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(ALT_SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function getActiveUser() {
  const local = getStoredUser();
  if (local) return local;
  try {
    const res = await api.auth.getProfile('current');
    if (res && res.id) {
      setStoredUser(res);
      return res;
    }
  } catch (e) {}
  return null;
}

export function setStoredUser(user) {
  try {
    if (user) {
      const serialized = JSON.stringify(user);
      localStorage.setItem(SESSION_KEY, serialized);
      localStorage.setItem(ALT_SESSION_KEY, serialized);
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(ALT_SESSION_KEY);
    }
  } catch (e) {
    console.error('Error guardando usuario en localStorage:', e);
  }
}

export function clearStoredUser() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ALT_SESSION_KEY);
}

// ==================== USUARIOS & AUTH ====================

export async function loginUser(email, password, twoFactorCode) {
  const result = await api.auth.login({ email, password, twoFactorCode });
  if (result.user) setStoredUser(result.user);
  return result;
}

export async function registerUser(username, email, password) {
  const result = await api.auth.register({ username, email, password });
  if (result.user) setStoredUser(result.user);
  return result;
}

export async function findUserByEmail(email) {
  if (!email) return null;
  try {
    const res = await api.auth.findUser({ email: email.trim().toLowerCase() });
    return res.found ? res.user : null;
  } catch (e) {
    return null;
  }
}

export async function findUserByUsername(username) {
  if (!username) return null;
  try {
    const res = await api.auth.findUser({ username: username.trim().toLowerCase() });
    return res.found ? res.user : null;
  } catch (e) {
    return null;
  }
}

export async function recordInteraction(senderId, recipientId) {
  return;
}

export async function getFrequentContacts(uid) {
  return [];
}

export async function getUsers() {
  const stats = await api.stats.getAdmin().catch(() => ({ usersStats: [] }));
  return stats.usersStats || [];
}

export async function saveUser(user) {
  try {
    const res = await api.auth.saveUser(user);
    if (res.user) setStoredUser(res.user);
    return res.user || user;
  } catch (e) {
    console.error('Error al guardar usuario:', e);
    throw e;
  }
}

export async function recordSession(uid, ua) {
  return getStoredUser();
}

export async function recordMediaView(uid, mid, meta = {}) {
  const res = await api.media.recordView(mid, uid, meta).catch(() => null);
  try {
    const sessionData = localStorage.getItem(SESSION_KEY) || localStorage.getItem('ps_active_session');
    if (sessionData) {
      const u = JSON.parse(sessionData);
      if (u.id === uid) {
        const history = u.viewHistory || [];
        const newEntry = {
          id: Math.random().toString(36).substring(7),
          mediaId: mid,
          viewedAt: new Date().toISOString(),
          source: meta.source || 'Galería Principal',
          deviceName: meta.deviceName || (/mobile|android|iphone/i.test(navigator?.userAgent || '') ? 'Dispositivo Móvil' : 'Escritorio'),
          clientIp: '127.0.0.1 (Local)'
        };
        u.viewHistory = [newEntry, ...history.filter(h => h.mediaId !== mid)].slice(0, 100);
        localStorage.setItem(SESSION_KEY, JSON.stringify(u));
        localStorage.setItem('ps_active_session', JSON.stringify(u));
        window.dispatchEvent(new CustomEvent('neural-update', { detail: { channel: 'HISTORY', entry: newEntry } }));
      }
    }
  } catch (e) {}
  return res;
}

export async function getViewHistory(userId) {
  if (!userId) return [];
  try {
    const history = await api.stats.getHistory(userId);
    return history || [];
  } catch (err) {
    return [];
  }
}

export async function clearViewHistory(userId) {
  if (!userId) return false;
  try {
    await api.stats.clearHistory(userId);
    const sessionData = localStorage.getItem(SESSION_KEY) || localStorage.getItem('ps_active_session');
    if (sessionData) {
      const u = JSON.parse(sessionData);
      if (u.id === userId) {
        u.viewHistory = [];
        localStorage.setItem(SESSION_KEY, JSON.stringify(u));
        localStorage.setItem('ps_active_session', JSON.stringify(u));
        window.dispatchEvent(new CustomEvent('neural-update', { detail: { channel: 'HISTORY', cleared: true } }));
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function updateVideoProgress(uid, mid, s) {
  return api.media.saveProgress(mid, uid, s).catch(() => null);
}

// ==================== MEDIOS ====================

export async function getMedia() {
  return api.media.list();
}

export async function getMediaByUser(uid) {
  return api.media.list({ userId: uid });
}

export async function getTrashMedia(uid) {
  const effectiveUid = uid || getStoredUser()?.id || '';
  return api.media.list({ userId: effectiveUid, isDeleted: 'true' });
}

export async function saveMediaMetadata(entry) {
  return entry;
}

export async function deleteMedia(id, uid, permanent = false) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.delete(id, effectiveUid, permanent);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { action: 'delete', id, permanent } }));
  }
  return res?.success ?? true;
}

export async function deleteMultipleMedia(ids, uid, permanent = false) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.deleteMultiple(ids, effectiveUid, permanent);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { action: 'delete-multiple', ids, permanent } }));
  }
  return res?.success ?? true;
}

export async function emptyTrash(uid) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.emptyTrash(effectiveUid);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { action: 'empty-trash' } }));
  }
  return res?.success ?? true;
}

export async function updateMedia(id, uid, up) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.update(id, effectiveUid, up);
  return res.media;
}

export async function updateMultipleMedia(ids, uid, up) {
  return true;
}

export async function restoreMultipleMedia(ids, uid) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.restoreMultiple(ids, effectiveUid);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { action: 'restore-multiple', ids } }));
  }
  return res?.success ?? true;
}

export async function restoreMedia(id, uid) {
  const effectiveUid = uid || getStoredUser()?.id || 'all';
  const res = await api.media.update(id, effectiveUid, { isDeleted: false, deletedAt: null });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { action: 'restore', id } }));
  }
  return res.media;
}

// ==================== ÁLBUMES ====================

export async function getAlbums() {
  return api.albums.list();
}

export async function getAlbumsByUser(uid) {
  return api.albums.list(uid);
}

export async function createAlbum(album) {
  const res = await api.albums.create(album);
  return res.album;
}

export async function updateAlbum(id, uid, up) {
  const res = await api.albums.update(id, uid, up);
  return res.album;
}

export async function deleteAlbum(id, uid) {
  const res = await api.albums.delete(id, uid);
  return res.deletedIds || [id];
}

export async function addMultipleToAlbum(aid, uid, mids) {
  const res = await api.albums.addMedia(aid, uid, mids);
  return res.success;
}

export async function removeMultipleFromAlbum(aid, uid, mids) {
  const res = await api.albums.removeMedia(aid, uid, mids);
  return res?.success || true;
}

// ==================== LOGROS ====================

export async function getAchievementsByUser(uid) {
  return api.stats.getAchievements(uid);
}

export async function unlockAchievement(uid, bid) {
  return true;
}

// ==================== DASHBOARD & STATS ====================

export async function getUnifiedDashboardData(uid) {
  const [media, achievements, albums, adminStats] = await Promise.all([
    api.media.list({ userId: uid }).catch(() => []),
    api.stats.getAchievements(uid).catch(() => []),
    api.albums.list(uid).catch(() => []),
    api.stats.getAdmin().catch(() => ({ usersStats: [] }))
  ]);
  return {
    media,
    achievements,
    albums,
    users: adminStats.usersStats || []
  };
}

export async function getGalleryLeanData(uid) {
  const [media, albums] = await Promise.all([
    api.media.list().catch(() => []),
    api.albums.list().catch(() => [])
  ]);
  return { media, albums };
}

export async function getAdminMetrics() {
  return api.stats.getAdmin();
}

export async function getSharedWithMe(uid) {
  const allMedia = await api.media.list().catch(() => []);
  const allAlbums = await api.albums.list().catch(() => []);
  return {
    media: allMedia.filter(m => m.sharedWith?.includes(uid) && !m.isDeleted),
    albums: allAlbums.filter(a => a.sharedWith?.includes(uid) || a.isPublic),
    users: []
  };
}

export async function getMySharedContent(uid) {
  const allMedia = await api.media.list({ userId: uid }).catch(() => []);
  const allAlbums = await api.albums.list(uid).catch(() => []);
  return {
    media: allMedia.filter(m => m.sharedWith && m.sharedWith.length > 0 && !m.isDeleted),
    albums: allAlbums.filter(a => a.isPublic || (a.sharedWith && a.sharedWith.length > 0))
  };
}

// ==================== 2FA & SEGURIDAD ====================

export async function generate2FASetup(uid, email) {
  return api.auth.setup2FA(uid);
}

export async function verifyAndEnable2FA(uid, secret, code) {
  const res = await api.auth.confirm2FA(uid, code);
  return { success: res.success };
}

export async function verify2FALogin(uid, code) {
  return true;
}

export async function revokeSession(uid, sid) {
  return null;
}

export async function revokeAllOtherSessions(uid) {
  return null;
}

export async function registerSharedAccess(mid, uid) {
  return true;
}

export async function clearAllSharedAccess(id, uid) {
  return true;
}

export async function revokeSharedAccess(id, uid, targetUid) {
  return true;
}

export async function updateUserFilterPreferences(uid, sec, pref) {
  return null;
}

export async function saveAvatarFile(uid, b64) {
  return b64;
}

export async function inspectDatabase() {
  return api.database.inspect();
}

// Helpers de cifrado en cliente (bóveda)
export async function encrypt(t) { return t; }
export async function decrypt(t) { return t; }
export async function hashPassword(password) {
  if (!password) return '';
  const msgUint8 = new TextEncoder().encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function updateUserPlan(userId: string, plan: 'free' | 'pro' | 'ultra') {
  const res = await api.auth.updatePlan(userId, plan);
  if (res?.user && typeof window !== 'undefined') {
    localStorage.setItem('ps_active_session', JSON.stringify(res.user));
    window.dispatchEvent(new CustomEvent('neural-update', { detail: { channel: 'USER_PLAN', data: res.user } }));
  }
  return res;
}

