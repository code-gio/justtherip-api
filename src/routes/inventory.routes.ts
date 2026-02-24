import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { listInventory } from '../controllers/inventory/list.controller.js';
import { sellCard } from '../controllers/inventory/sell.controller.js';
import { shipCard } from '../controllers/inventory/ship.controller.js';

const router = Router();

router.get('/', requireAuth, listInventory);
router.post('/sell', requireAuth, sellCard);
router.post('/ship', requireAuth, shipCard);

export default router;
