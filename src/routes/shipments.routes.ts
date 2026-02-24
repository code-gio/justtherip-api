import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { listShipments } from '../controllers/shipments/list.controller.js';

const router = Router();

router.get('/', requireAuth, listShipments);

export default router;
