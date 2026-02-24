import { Router } from 'express';
import shipmentsRoutes from './shipments.routes.js';
import cardsRoutes from './cards.routes.js';
import packsRoutes from './packs.routes.js';
import simulatorRoutes from './simulator.routes.js';
import usersRoutes from './users.routes.js';
import systemConfigRoutes from './system-config.routes.js';

const router = Router();

router.use('/shipments', shipmentsRoutes);
router.use('/cards', cardsRoutes);
router.use('/packs', packsRoutes);
router.use('/simulator', simulatorRoutes);
router.use('/users', usersRoutes);
router.use('/system-config', systemConfigRoutes);

export default router;
