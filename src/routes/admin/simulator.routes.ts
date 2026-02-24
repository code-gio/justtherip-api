import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { getSimulatorPack } from '../../controllers/admin/simulator.packs.controller.js';

const router = Router();

router.get('/packs/:packId', requireAuth, requireAdmin, getSimulatorPack);

export default router;
