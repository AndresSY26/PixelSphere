import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

import { ensureDirectories, cleanupExpiredTrash } from './src/services/storageService.js';
import apiRouter from './src/routes/index.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import { decryptZeroKnowledge } from './src/services/mediaOptimizationService.js';
import { downloadFromCloudStorage } from './src/services/cloudStorageService.js';
import { query } from './src/db/index.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

// Parsers para JSON y formularios
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos multimedia directamente desde Firebase Storage en memoria
// Cero almacenamiento en el disco del servidor (Zero Server-Disk Storage)
app.use('/uploads', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  try {
    const decodedPath = decodeURIComponent(req.path);
    const parts = decodedPath.split('/').filter(Boolean);
    let candidateCloudPath = null;
    if (parts.length >= 3 && parts[1] === 'thumbnails') {
      candidateCloudPath = `thumbnails/${parts[0]}/${parts[2]}.enc`;
    } else if (parts.length >= 3 && (parts[1] === 'image' || parts[1] === 'video')) {
      candidateCloudPath = `media/${parts[0]}/${parts[1]}/${parts[2]}.enc`;
    }

    let cloudBuffer = null;
    if (candidateCloudPath) {
      try {
        cloudBuffer = await downloadFromCloudStorage(candidateCloudPath);
      } catch (e) {}
    }

    if (!cloudBuffer) {
      try {
        const publicUrl = `/uploads${decodedPath}`;
        const dbRes = await query('SELECT cloud_storage_path FROM media WHERE url = $1 OR thumbnail_url = $1 LIMIT 1', [publicUrl]);
        if (dbRes?.rows?.[0]?.cloud_storage_path) {
          cloudBuffer = await downloadFromCloudStorage(dbRes.rows[0].cloud_storage_path);
        }
      } catch (dbErr) {}
    }

    if (!cloudBuffer || cloudBuffer.length === 0) {
      return res.status(404).send('Archivo no encontrado en Firebase Storage.');
    }

    const isEncrypted = cloudBuffer.length >= 4 && cloudBuffer.subarray(0, 4).toString('utf-8') === 'PXZK';
    const decrypted = isEncrypted ? decryptZeroKnowledge(cloudBuffer) : cloudBuffer;

    let contentType = 'application/octet-stream';
    if (decodedPath.endsWith('.webp')) contentType = 'image/webp';
    else if (decodedPath.endsWith('.webm')) contentType = 'video/webm';
    else if (decodedPath.endsWith('.mp4')) contentType = 'video/mp4';
    else if (decodedPath.endsWith('.jpg') || decodedPath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (decodedPath.endsWith('.png')) contentType = 'image/png';

    const etag = `"${crypto.createHash('md5').update(decrypted).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);

    const range = req.headers.range;
    if (range) {
      const total = decrypted.length;
      const partsRange = range.replace(/bytes=/, '').split('-');
      const start = parseInt(partsRange[0], 10);
      const end = partsRange[1] ? parseInt(partsRange[1], 10) : total - 1;

      if (start >= total || end >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        return res.end();
      }

      const chunk = decrypted.subarray(start, end + 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': chunk.length,
        'Content-Type': contentType
      });
      return res.end(chunk);
    }

    res.setHeader('Content-Length', decrypted.length);
    return res.end(decrypted);
  } catch (err) {
    console.warn('[UploadsHandler] Fallo en recuperación desde Firebase Storage:', err.message);
    return res.status(500).send('Error recuperando medio.');
  }
});

// Rutas de API REST
app.use('/api', apiRouter);

// Ruta de comprobación de salud del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'PixelSphere Node.js Backend Engine'
  });
});

// Manejador global de errores
app.use(errorHandler);

// Inicialización atómica y arranque del servidor
ensureDirectories().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PixelSphere Backend] Servidor activo en http://localhost:${PORT}`);
    console.log('[PixelSphere Backend] Motor de persistencia: Neon PostgreSQL + Firebase Storage');

    // Purga física de elementos en papelera que superen los 30 días (PostgreSQL y Firebase Storage)
    cleanupExpiredTrash(30).catch((err) => {
      console.warn('[PixelSphere Backend] Advertencia en purga inicial de 30 días:', err.message);
    });

    // Programar purga automática cada 6 horas
    const trashInterval = setInterval(() => {
      cleanupExpiredTrash(30).catch((err) => {
        console.warn('[PixelSphere Backend] Advertencia en purga programada:', err.message);
      });
    }, 6 * 60 * 60 * 1000);
    trashInterval.unref();
  });
}).catch((err) => {
  console.error('[PixelSphere Backend] Fallo crítico al inicializar base de datos:', err);
  process.exit(1);
});
