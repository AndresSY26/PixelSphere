import { Router } from 'express';
import { handleAutoTag, handleGenerativeEdit } from '../controllers/aiController.js';

const router = Router();

router.post('/auto-tag', handleAutoTag);
router.post('/edit', handleGenerativeEdit);

export default router;
