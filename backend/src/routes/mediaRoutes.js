import { Router } from 'express';
import { 
  listMedia, 
  getMediaById, 
  uploadMedia, 
  handleChunkedUpload,
  streamVideo, 
  updateMedia, 
  deleteMedia, 
  deleteMultiple, 
  restoreMultiple,
  recordView,
  saveProgress
} from '../controllers/mediaController.js';
import { upload, uploadChunk } from '../middlewares/uploadMiddleware.js';

const router = Router();

router.get('/', listMedia);
router.post('/upload', uploadChunk.any(), handleChunkedUpload);
router.post('/delete-multiple', deleteMultiple);
router.post('/restore-multiple', restoreMultiple);
router.get('/:id', getMediaById);
router.put('/:id', updateMedia);
router.delete('/:id', deleteMedia);
router.get('/:id/stream', streamVideo);
router.post('/:id/view', recordView);
router.post('/:id/progress', saveProgress);

export default router;
