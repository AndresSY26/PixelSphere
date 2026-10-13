import { Router } from 'express';
import authRoutes from './authRoutes.js';
import mediaRoutes from './mediaRoutes.js';
import albumRoutes from './albumRoutes.js';
import aiRoutes from './aiRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import { handleNeuralStream } from '../controllers/streamController.js';
import { handleChunkedUpload } from '../controllers/mediaController.js';
import { uploadChunk } from '../middlewares/uploadMiddleware.js';
import { importFromCloud, downloadDriveProxy, importDriveBatch } from '../controllers/cloudController.js';
import { getAdminStats, getAchievements, getHistory, clearHistory } from '../controllers/statsController.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/media', mediaRoutes);
router.use('/albums', albumRoutes);
router.use('/ai', aiRoutes);
router.use('/payments', paymentRoutes);

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
router.delete('/stats/history/:userId', clearHistory);

// Reconciliación y auditoría de almacenamiento (Cuota 3GB)
router.post('/storage/recalculate', async (req, res) => {
  try {
    const { auditAndRecalculateUserStorage } = await import('../services/storageService.js');
    const userId = req.body?.userId || req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: 'Falta userId' });
    const result = await auditAndRecalculateUserStorage(userId);
    if (!result) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ success: true, user: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Estado del motor de base de datos Neon PostgreSQL y Firebase Storage
router.get('/database/inspect', async (req, res) => {
  try {
    const { query } = await import('../db/index.js');
    const dbTest = await query('SELECT NOW() as server_time, (SELECT count(*) FROM users) as users_count, (SELECT count(*) FROM media) as media_count');
    res.json({
      status: 'active',
      database: 'Neon PostgreSQL (Cloud)',
      storage: 'Firebase Storage (Zero-Knowledge AES-256-GCM)',
      serverTime: dbTest.rows[0].server_time,
      usersCount: parseInt(dbTest.rows[0].users_count, 10),
      mediaCount: parseInt(dbTest.rows[0].media_count, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
