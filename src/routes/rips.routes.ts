import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { getBalance } from '../controllers/rips/balance.controller.js';
import { getBundles } from '../controllers/rips/bundles.controller.js';

const router = Router();

router.get('/balance', requireAuth, getBalance);
router.get('/bundles', getBundles);

export default router;
