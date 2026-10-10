import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.resolve(__dirname, '../../');
export const TEMP_UPLOADS_DIR = path.join(os.tmpdir(), 'pixelsphere_temp_uploads');
export const UPLOADS_DIR = TEMP_UPLOADS_DIR;

export const ENCRYPTION_KEY = Buffer.from('f36e82671573282b12da05b1e195a0d585820bb105a218056eb30119105a2185', 'hex');
export const IV_LENGTH = 16;
