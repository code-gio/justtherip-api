import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { getPackProbabilities } from '../../controllers/admin/packs.probabilities.controller.js';

const router = Router();

router.get('/:packId/probabilities', requireAuth, requireAdmin, getPackProbabilities);

export default router;
