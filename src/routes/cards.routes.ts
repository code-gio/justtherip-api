import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { searchCards } from '../controllers/cards/search.controller.js';
import { bulkVerify } from '../controllers/cards/bulkVerify.controller.js';

const router = Router();

router.post('/search', requireAuth, searchCards);
router.post('/bulk-verify', requireAuth, bulkVerify);

export default router;
