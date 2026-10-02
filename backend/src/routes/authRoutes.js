import { Router } from 'express';
import { 
  login, 
  register, 
  findUser,
  handleSaveUser,
  setup2FA, 
  confirm2FA, 
  disable2FA, 
  getProfile, 
  updateProfile 
} from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/find', findUser);
router.post('/save', handleSaveUser);
router.post('/2fa/setup', setup2FA);
router.post('/2fa/confirm', confirm2FA);
router.post('/2fa/disable', disable2FA);
router.get('/profile/:id', getProfile);
router.put('/profile/:id', updateProfile);

export default router;
