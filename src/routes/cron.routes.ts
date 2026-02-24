import { Router } from 'express';
import { requireCronSecret, runUpdateMtgCards } from '../controllers/cron/updateMtgCards.controller.js';

const router = Router();

router.get('/update-mtg-cards', requireCronSecret, runUpdateMtgCards);

export default router;
