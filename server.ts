import express from 'express';
import cors from 'cors';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

import { ensureDirectories, cleanupExpiredTrash } from './backend/src/services/storageService.js';
import apiRouter from './backend/src/routes/index.js';
import { errorHandler } from './backend/src/middlewares/errorHandler.js';
import { decryptZeroKnowledge } from './backend/src/services/mediaOptimizationService.js';
import { downloadFromCloudStorage } from './backend/src/services/cloudStorageService.js';
import { query } from './backend/src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await ensureDirectories();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Compresión GZIP de alta eficiencia para reducir consumo de red y costos de egress
  app.use(compression());

  // Permissive CORS for dev and preview
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['*']
  }));

  // Parsers
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

      let cloudBuf = null;
      if (candidateCloudPath) {
        try {
          cloudBuf = await downloadFromCloudStorage(candidateCloudPath);
        } catch (e) {}
      }

      // Si no se encontró por convención, buscar en Neon PostgreSQL por URL
      if (!cloudBuf) {
        try {
          const publicUrl = `/uploads${decodedPath}`;
          const dbRes = await query('SELECT cloud_storage_path FROM media WHERE url = $1 OR thumbnail_url = $1 LIMIT 1', [publicUrl]);
          if (dbRes?.rows?.[0]?.cloud_storage_path) {
            cloudBuf = await downloadFromCloudStorage(dbRes.rows[0].cloud_storage_path);
          }
        } catch (dbErr) {}
      }

      if (!cloudBuf || cloudBuf.length === 0) {
        return res.status(404).send('Archivo no encontrado en Firebase Storage.');
      }

      // Detectar cifrado Zero-Knowledge (cabecera 'PXZK')
      const isEncrypted = cloudBuf.length >= 4 && cloudBuf.subarray(0, 4).toString('utf-8') === 'PXZK';
      const decrypted = isEncrypted ? decryptZeroKnowledge(cloudBuf) : cloudBuf;

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
    } catch (err: any) {
      console.warn('[UploadsHandler] Error sirviendo medio desde Firebase Storage:', err.message);
      return res.status(500).send('Error recuperando medio.');
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      service: 'PixelSphere Node.js Backend Engine'
    });
  });

  // REST API Routes
  app.use('/api', apiRouter);

  // Global Error Handler for API
  app.use(errorHandler);

  // Frontend integration (Vite dev middleware or static production build)
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendDir = path.resolve(__dirname, 'frontend');
  const distDir = path.resolve(frontendDir, 'dist');
  const publicDir = path.resolve(frontendDir, 'public');

  // Explicit PWA Service Worker handler with exact MIME type
  app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const swDist = path.join(distDir, 'sw.js');
    const swPublic = path.join(publicDir, 'sw.js');

    if (fs.existsSync(swDist)) {
      return res.sendFile(swDist);
    }
    if (fs.existsSync(swPublic)) {
      return res.sendFile(swPublic);
    }
    return res.status(200).send('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));');
  });

  // Explicit PWA Manifest handler
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    const manifestDist = path.join(distDir, 'manifest.json');
    const manifestPublic = path.join(publicDir, 'manifest.json');

    if (fs.existsSync(manifestDist)) {
      return res.sendFile(manifestDist);
    }
    if (fs.existsSync(manifestPublic)) {
      return res.sendFile(manifestPublic);
    }
    return res.status(404).send('Not found');
  });

  // Static assets from frontend/public
  app.use(express.static(publicDir));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.resolve(frontendDir, 'vite.config.js'),
      root: frontendDir,
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PixelSphere] Servidor activo en http://0.0.0.0:${PORT}`);
  });
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;
  server.requestTimeout = 0;

  // Purga automática de elementos con más de 30 días en papelera (PostgreSQL + Firebase Storage)
  const scheduleTrashPurge = () => {
    cleanupExpiredTrash(30)
      .then((res: any) => {
        if (res?.count > 0) {
          console.log(`[PixelSphere] 🧹 Purga automática completada: ${res.count} elementos eliminados de PostgreSQL y Firebase Storage.`);
        }
      })
      .catch((err: any) => {
        console.warn('[PixelSphere] Aviso en purga automática de papelera:', err.message);
      });
  };
  setTimeout(scheduleTrashPurge, 15000); // 15 segundos tras iniciar
  setInterval(scheduleTrashPurge, 24 * 60 * 60 * 1000); // Cada 24 horas
}

startServer().catch((err) => {
  console.error('[PixelSphere] Fallo crítico al iniciar el servidor:', err);
  process.exit(1);
});
