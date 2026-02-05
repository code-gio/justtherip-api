import { Router } from 'express';
import { getHealthHandler } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getHealthHandler);

export default router;
