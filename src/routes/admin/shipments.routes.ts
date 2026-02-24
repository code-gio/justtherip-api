import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { listAdminShipments } from '../../controllers/admin/shipments.list.controller.js';
import { updateAdminShipment } from '../../controllers/admin/shipments.update.controller.js';
import { getPurchaseOptions } from '../../controllers/admin/shipments.purchaseOptions.controller.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, listAdminShipments);
router.patch('/:id', requireAuth, requireAdmin, updateAdminShipment);
router.get('/purchase-options', requireAuth, requireAdmin, getPurchaseOptions);

export default router;
