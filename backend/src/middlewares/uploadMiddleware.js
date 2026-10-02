import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../config/constants.js';

/**
 * CONFIGURACIÓN DE ALMACENAMIENTO FÍSICO CON MULTER
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.userId || 'anonymous';
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const targetDir = path.join(UPLOADS_DIR, userId, type);

    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Math.random().toString(36).substring(2, 11);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueId}_${safeName}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB por archivo
  }
});
