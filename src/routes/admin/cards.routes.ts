import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { adminSearchCards } from '../../controllers/admin/cards.search.controller.js';
import { adminBulkVerify } from '../../controllers/admin/cards.bulkVerify.controller.js';

const router = Router();

router.get('/search', requireAuth, requireAdmin, adminSearchCards);
router.post('/search', requireAuth, requireAdmin, adminSearchCards);
router.post('/bulk-verify', requireAuth, requireAdmin, adminBulkVerify);

export default router;
