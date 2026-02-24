import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { getSystemConfig, updateSystemConfig } from '../../controllers/admin/systemConfig.controller.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, getSystemConfig);
router.patch('/', requireAuth, requireAdmin, updateSystemConfig);

export default router;
