'use server';

import * as core from './storage-core';
import { User, Media, Album } from './types';

/**
 * CAPA DE SERVICIO PIXELSPHERE v46.0
 * Server Actions para comunicación entre la UI y el Cerebro Neural.
 */

export async function ensureDirectories() { return core.ensureDirectories(); }
export async function hashPassword(p: string) { return core.hashPassword(p); }
export async function findUserByEmail(e: string) { return core.findUserByEmail(e); }
export async function saveUser(u: User) { return core.saveUser(u); }
export async function recordSession(uid: string, ua: string) { return core.recordSession(uid, ua); }
export async function getUsers() { return core.getUsers(); }

// --- HISTORIAL ---
export async function recordMediaView(uid: string, mid: string) { return core.recordMediaView(uid, mid); }
export async function updateVideoProgress(uid: string, mid: string, s: number) { return core.updateVideoProgress(uid, mid, s); }

export async function getMediaByUser(uid: string) { return core.getMediaByUser(uid); }
export async function saveMediaMetadata(entry: Media) { return core.saveMediaMetadata(entry); }
export async function deleteMedia(id: string, uid: string) { return core.deleteMedia(id, uid); }
export async function deleteMultipleMedia(ids: string[], uid: string) { return core.deleteMultipleMedia(ids, uid); }
export async function updateMedia(id: string, uid: string, up: Partial<Media>) { return core.updateMedia(id, uid, up); }
export async function updateMultipleMedia(ids: string[], uid: string, up: Partial<Media>) { return core.updateMultipleMedia(ids, uid, up); }

export async function getAlbumsByUser(uid: string) { return core.getAlbumsByUser(uid); }
export async function createAlbum(a: Album) { return core.createAlbum(a); }
export async function updateAlbum(id: string, uid: string, up: Partial<Album>) { return core.updateAlbum(id, uid, up); }
export async function deleteAlbum(id: string, uid: string) { return core.deleteAlbum(id, uid); }

export async function addMultipleToAlbum(aid: string, uid: string, mids: string[]) {
  const albums = await core.getAlbums();
  const album = albums.find(a => a.id === aid && a.userId === uid);
  if (!album) return null;
  const next = Array.from(new Set([...(album.mediaIds || []), ...mids]));
  return core.updateAlbum(aid, uid, { mediaIds: next });
}

export async function removeMultipleFromAlbum(aid: string, uid: string, mids: string[]) {
  const albums = await core.getAlbums();
  const album = albums.find(a => a.id === aid && a.userId === uid);
  if (!album) return null;
  const next = (album.mediaIds || []).filter(id => !mids.includes(id));
  return core.updateAlbum(aid, uid, { mediaIds: next });
}

export async function unlockAchievement(uid: string, bid: string) { return core.unlockAchievement(uid, bid); }
export async function getAchievementsByUser(uid: string) { return core.getAchievementsByUser(uid); }

export async function getUnifiedDashboardData(uid: string) {
  const [media, achievements, albums, users] = await Promise.all([
    core.getMediaByUser(uid),
    core.getAchievementsByUser(uid),
    core.getAlbumsByUser(uid),
    core.getUsers()
  ]);
  const leanUsers = users.map(({ passwordHash, vaultPasswordHash, ...rest }) => ({ ...rest }));
  return { media, achievements, albums, users: leanUsers };
}

export async function getGalleryLeanData(uid: string) {
  const [media, albums] = await Promise.all([core.getMediaByUser(uid), core.getAlbumsByUser(uid)]);
  return { media, albums };
}

export async function findUserByUsername(u: string) {
  const users = await core.getUsers();
  return users.find(usr => usr.username.toLowerCase() === u.trim().toLowerCase());
}

export async function recordInteraction(s: string, r: string) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === s);
  if (u) {
    const next = [r, ...(u.recentRecipients || []).filter(id => id !== r)].slice(0, 10);
    await core.saveUser({ ...u, recentRecipients: next });
  }
}

export async function getFrequentContacts(uid: string) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === uid);
  if (!u || !u.recentRecipients) return [];
  return u.recentRecipients.map(id => users.find(usr => usr.id === id)).filter((v): v is User => !!v);
}

export async function generate2FASetup(uid: string, e: string) { return core.generate2FASecret(uid, e); }
export async function verifyAndEnable2FA(uid: string, s: string, c: string) {
  if (await core.verify2FACode(s, c)) {
    const users = await core.getUsers();
    const u = users.find(usr => usr.id === uid);
    if (u) {
      const updated = await core.saveUser({ ...u, is2FAEnabled: true, twoFASecret: s });
      return { success: true, user: updated };
    }
  }
  return { success: false };
}

export async function verify2FALogin(uid: string, c: string) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === uid);
  return u?.twoFASecret ? core.verify2FACode(u.twoFASecret, c) : false;
}

export async function revokeSession(uid: string, sid: string) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === uid);
  if (u) return core.saveUser({ ...u, sessions: (u.sessions || []).filter(s => s.id !== sid) });
  return null;
}

export async function revokeAllOtherSessions(uid: string) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === uid);
  if (u) return core.saveUser({ ...u, sessions: (u.sessions || []).filter(s => s.isCurrent) });
  return null;
}

export async function encrypt(t: string) { return core.encrypt(t); }
export async function decrypt(t: string) { return core.decrypt(t); }
export async function saveAvatarFile(uid: string, b: string) { return core.saveAvatarFile(uid, b); }

export async function updateUserFilterPreferences(uid: string, sec: any, pref: any) {
  const users = await core.getUsers();
  const u = users.find(usr => usr.id === uid);
  if (u) {
    const next = { ...u.filterPreferences, [sec]: { ...(u.filterPreferences?.[sec as keyof typeof u.filterPreferences] || {}), ...pref } };
    return core.saveUser({ ...u, filterPreferences: next as any });
  }
  return null;
}

export async function clearAllSharedAccess(id: string, uid: string) { return core.clearAllSharedAccess(id, uid); }

export async function revokeSharedAccess(id: string, uid: string, targetUid: string) {
  const [media, albums] = await Promise.all([core.getMedia(), core.getAlbums()]);
  const item = media.find(m => m.id === id && m.userId === uid);
  if (item) {
    const next = (item.sharedWith || []).filter(u => u !== targetUid);
    return core.updateMedia(id, uid, { sharedWith: next });
  }
  const album = albums.find(a => a.id === id && a.userId === uid);
  if (album) {
    const next = (album.sharedWith || []).filter(u => u !== targetUid);
    return core.updateAlbum(id, uid, { sharedWith: next });
  }
  return null;
}

export async function getSharedWithMe(uid: string) {
  const [media, albums, users] = await Promise.all([core.getMedia(), core.getAlbums(), core.getUsers()]);
  return {
    media: media.filter(m => m.sharedWith?.includes(uid) && !m.isDeleted),
    albums: albums.filter(a => a.sharedWith?.includes(uid) || a.isPublic),
    users: users.map(({ passwordHash, vaultPasswordHash, ...u }) => u)
  };
}

export async function getMySharedContent(uid: string) {
  const [media, albums] = await Promise.all([core.getMedia(), core.getAlbums()]);
  return {
    media: media.filter(m => m.userId === uid && m.sharedWith && m.sharedWith.length > 0 && !m.isDeleted),
    albums: albums.filter(a => a.userId === uid && (a.isPublic || (a.sharedWith && a.sharedWith.length > 0)))
  };
}

export async function getMedia() { return core.getMedia(); }
export async function getAlbums() { return core.getAlbums(); }
export async function restoreMedia(id: string, uid: string) { return core.updateMedia(id, uid, { isDeleted: false, deletedAt: undefined }); }
export async function restoreMultipleMedia(ids: string[], uid: string) { return core.restoreMultipleMedia(ids, uid); }
export async function registerSharedAccess(mid: string, uid: string) { return true; }

export async function getAdminMetrics() {
  return core.getAdminMetrics();
}
