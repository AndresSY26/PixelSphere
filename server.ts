import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

import { UPLOADS_DIR } from './backend/src/config/constants.js';
import { ensureDirectories } from './backend/src/services/storageService.js';
import apiRouter from './backend/src/routes/index.js';
import { errorHandler } from './backend/src/middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await ensureDirectories();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Permissive CORS for dev and preview
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range']
  }));

  // Parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Uploads static directory
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    next();
  }, express.static(UPLOADS_DIR));

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PixelSphere] Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[PixelSphere] Fallo crítico al iniciar el servidor:', err);
  process.exit(1);
});
