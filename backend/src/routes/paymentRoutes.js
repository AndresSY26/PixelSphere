import { Router } from 'express';
import { 
  getGooglePayConfig, 
  processGooglePayPayment, 
  getPaymentHistory 
} from '../controllers/paymentController.js';

const router = Router();

router.get('/config/google-pay', getGooglePayConfig);
router.post('/google-pay/process', processGooglePayPayment);
router.get('/history/:userId', getPaymentHistory);

export default router;
