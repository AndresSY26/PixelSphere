import { Router } from 'express';
import { 
  listAlbums, 
  getAlbumById, 
  createAlbum, 
  updateAlbum, 
  deleteAlbum, 
  addMediaToAlbum 
} from '../controllers/albumController.js';

const router = Router();

router.get('/', listAlbums);
router.post('/', createAlbum);
router.get('/:id', getAlbumById);
router.put('/:id', updateAlbum);
router.delete('/:id', deleteAlbum);
router.post('/:id/media', addMediaToAlbum);

export default router;
