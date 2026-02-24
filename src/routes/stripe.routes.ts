import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { createCheckout } from '../controllers/stripe/createCheckout.controller.js';

const router = Router();

router.post('/create-checkout', requireAuth, createCheckout);
// POST /stripe/webhook is mounted in app.ts with raw body parser

export default router;
