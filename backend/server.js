import express from 'express';
import cors from 'cors';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

import { UPLOADS_DIR } from './src/config/constants.js';
import { ensureDirectories } from './src/services/storageService.js';
import apiRouter from './src/routes/index.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

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
    // Permitir solicitudes sin origin (como apps móviles o curl) o presentes en allowedOrigins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Abierto en desarrollo
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

// Parsers para JSON y formularios (límite ampliado para imágenes y base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos subidos físicamente
app.use('/uploads', express.static(UPLOADS_DIR));

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
    console.log(`[PixelSphere Backend] Carpeta de subidas: ${UPLOADS_DIR}`);
  });
}).catch((err) => {
  console.error('[PixelSphere Backend] Fallo crítico al inicializar directorios:', err);
  process.exit(1);
});
