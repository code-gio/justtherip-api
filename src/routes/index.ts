import { Router } from 'express';
import healthRoutes from './health.routes.js';
import ripsRoutes from './rips.routes.js';
import cardsRoutes from './cards.routes.js';
import packsRoutes from './packs.routes.js';
import inventoryRoutes from './inventory.routes.js';
import shipmentsRoutes from './shipments.routes.js';
import shippingAddressesRoutes from './shipping-addresses.routes.js';
import stripeRoutes from './stripe.routes.js';
import mediaRoutes from './media.routes.js';
import adminRoutes from './admin/index.js';
import cronRoutes from './cron.routes.js';

const router = Router();

router.use(healthRoutes);
router.use('/rips', ripsRoutes);
router.use('/cards', cardsRoutes);
router.use('/packs', packsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/shipments', shipmentsRoutes);
router.use('/shipping-addresses', shippingAddressesRoutes);
router.use('/stripe', stripeRoutes);
router.use('/media', mediaRoutes);
router.use('/admin', adminRoutes);
router.use('/cron', cronRoutes);

export default router;
