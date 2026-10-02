import { Router } from 'express';
import authRoutes from './authRoutes.js';
import mediaRoutes from './mediaRoutes.js';
import albumRoutes from './albumRoutes.js';
import aiRoutes from './aiRoutes.js';
import { handleNeuralStream } from '../controllers/streamController.js';
import { handleChunkedUpload } from '../controllers/mediaController.js';
import { uploadChunk } from '../middlewares/uploadMiddleware.js';
import { importFromCloud } from '../controllers/cloudController.js';
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

// Estadísticas y gamificación
router.get('/stats/admin', getAdminStats);
router.get('/stats/achievements/:userId', getAchievements);
router.get('/stats/history/:userId', getHistory);

export default router;
