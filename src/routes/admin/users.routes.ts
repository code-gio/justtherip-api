import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { getUserTransactions } from '../../controllers/admin/users.transactions.controller.js';

const router = Router();

router.get('/:userId/transactions', requireAuth, requireAdmin, getUserTransactions);

export default router;
