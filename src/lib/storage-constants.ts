import path from 'node:path';

/**
 * PixelSphere Storage Constants
 * Centralización de rutas físicas para evitar conflictos con 'use server'.
 */

export const DATA_DIR = path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export const FILE_PATHS = {
  USERS: path.join(DATA_DIR, 'users.json'),
  MEDIA: path.join(DATA_DIR, 'media.json'),
  ACHIEVEMENTS: path.join(DATA_DIR, 'achievements.json'),
  ALBUMS: path.join(DATA_DIR, 'albums.json')
};
