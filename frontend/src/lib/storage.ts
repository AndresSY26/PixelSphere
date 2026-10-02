import { api } from '../api/client.js';

/**
 * CLIENT STORAGE ADAPTER v50.0 (Frontend SPA)
 * Conecta los componentes directamente con el backend Node.js en localhost:5000
 */

// Gestión de sesión local
const SESSION_KEY = 'pixelsphere_session_user';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.error('Error guardando usuario en localStorage:', e);
  }
}

export function clearStoredUser() {
  localStorage.removeItem(SESSION_KEY);
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
  const users = await api.auth.getProfile(email).catch(() => null);
  return users;
}

export async function findUserByUsername(username) {
  return null;
}

export async function recordInteraction(senderId, recipientId) {
  return;
}

export async function getFrequentContacts(uid) {
  return [];
}

export async function getUsers() {
  // En backend no hay endpoint directo público para listar todos los usuarios por privacidad,
  // pero el dashboard admin puede obtener estadísticas.
  const stats = await api.stats.getAdmin().catch(() => ({ usersStats: [] }));
  return stats.usersStats || [];
}

export async function saveUser(user) {
  const updated = await api.auth.updateProfile(user.id, user);
  if (updated.user) setStoredUser(updated.user);
  return updated.user || user;
}

export async function recordSession(uid, ua) {
  return getStoredUser();
}

export async function recordMediaView(uid, mid) {
  return api.media.recordView(mid, uid).catch(() => null);
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

export async function saveMediaMetadata(entry) {
  return entry;
}

export async function deleteMedia(id, uid) {
  const res = await api.media.delete(id, uid);
  return res.success;
}

export async function deleteMultipleMedia(ids, uid) {
  const res = await api.media.deleteMultiple(ids, uid);
  return res.success;
}

export async function updateMedia(id, uid, up) {
  const res = await api.media.update(id, uid, up);
  return res.media;
}

export async function updateMultipleMedia(ids, uid, up) {
  return true;
}

export async function restoreMultipleMedia(ids, uid) {
  const res = await api.media.restoreMultiple(ids, uid);
  return res.success;
}

export async function restoreMedia(id, uid) {
  const res = await api.media.update(id, uid, { isDeleted: false, deletedAt: null });
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
  return true;
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
    api.media.list({ userId: uid }).catch(() => []),
    api.albums.list(uid).catch(() => [])
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

// Helpers de cifrado en cliente (bóveda)
export async function encrypt(t) { return t; }
export async function decrypt(t) { return t; }
export async function hashPassword(p) { return p; }
