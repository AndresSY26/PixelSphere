import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.resolve(__dirname, '../../');
export const DATA_DIR = path.join(BACKEND_ROOT, 'data');
export const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');

export const FILE_PATHS = {
  USERS: path.join(DATA_DIR, 'users.json'),
  MEDIA: path.join(DATA_DIR, 'media.json'),
  ALBUMS: path.join(DATA_DIR, 'albums.json'),
  ACHIEVEMENTS: path.join(DATA_DIR, 'achievements.json')
};

export const ENCRYPTION_KEY = Buffer.from('f36e82671573282b12da05b1e195a0d585820bb105a218056eb30119105a2185', 'hex');
export const IV_LENGTH = 16;
