import express from 'express';
import { 
  createOrder, 
  receiveWebhook
} from '../controllers/mercadopago';

const router = express.Router();

router.post('/create-order', createOrder);
router.post('/webhook', receiveWebhook);

export default router;
