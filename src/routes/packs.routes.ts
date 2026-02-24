import { Router } from 'express';
import { attachUser, requireAuth } from '../middleware/index.js';
import { listPacks } from '../controllers/packs/list.controller.js';
import { getPackByIdHandler } from '../controllers/packs/getById.controller.js';
import { openPack } from '../controllers/packs/open.controller.js';

const router = Router();

// Public (optional auth for balance): list active packs with top 3 cards; if logged in, includes balance
// Mounted at /packs: GET /v1/packs can arrive as path '' or '/'
router.get('/', attachUser, listPacks);
router.get('', attachUser, listPacks);
// Pack detail by id (optional auth for balance + sellbackRate)
router.get('/:id', attachUser, getPackByIdHandler);
router.post('/open', requireAuth, openPack);

export default router;
