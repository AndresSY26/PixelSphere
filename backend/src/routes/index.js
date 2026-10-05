import { Router } from 'express';
import authRoutes from './authRoutes.js';
import mediaRoutes from './mediaRoutes.js';
import albumRoutes from './albumRoutes.js';
import aiRoutes from './aiRoutes.js';
import { handleNeuralStream } from '../controllers/streamController.js';
import { handleChunkedUpload } from '../controllers/mediaController.js';
import { uploadChunk } from '../middlewares/uploadMiddleware.js';
import { importFromCloud, downloadDriveProxy, importDriveBatch } from '../controllers/cloudController.js';
import { getAdminStats, getAchievements, getHistory } from '../controllers/statsController.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/media', mediaRoutes);
router.use('/albums', albumRoutes);
router.use('/ai', aiRoutes);

// Ingesta por fragmentos y directa
router.post('/upload', uploadChunk.any(), handleChunkedUpload);

// SSE Neural Stream
router.get('/neural-stream', handleNeuralStream);

// Cloud Import
router.post('/cloud/import', importFromCloud);
router.post('/cloud/import-drive-batch', importDriveBatch);
router.get('/cloud/drive-file', downloadDriveProxy);
router.post('/cloud/drive-file', downloadDriveProxy);

// Estadísticas y gamificación
router.get('/stats/admin', getAdminStats);
router.get('/stats/achievements/:userId', getAchievements);
router.get('/stats/history/:userId', getHistory);

// Inspección en vivo del almacenamiento JSON en disco
router.get('/database/inspect', async (req, res) => {
  try {
    const fs = await import('node:fs/promises');
    const { FILE_PATHS } = await import('../config/constants.js');
    const [usersRaw, mediaRaw, albumsRaw, achievementsRaw] = await Promise.all([
      fs.readFile(FILE_PATHS.USERS, 'utf-8').catch(() => '[]'),
      fs.readFile(FILE_PATHS.MEDIA, 'utf-8').catch(() => '[]'),
      fs.readFile(FILE_PATHS.ALBUMS, 'utf-8').catch(() => '[]'),
      fs.readFile(FILE_PATHS.ACHIEVEMENTS, 'utf-8').catch(() => '[]')
    ]);
    res.json({
      paths: FILE_PATHS,
      files: {
        'users.json': JSON.parse(usersRaw || '[]'),
        'media.json': JSON.parse(mediaRaw || '[]'),
        'albums.json': JSON.parse(albumsRaw || '[]'),
        'achievements.json': JSON.parse(achievementsRaw || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
