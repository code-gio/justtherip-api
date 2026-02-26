import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/index.js';
import { listAdminPacksHandler } from '../../controllers/admin/packs.list.controller.js';
import { createAdminPackHandler } from '../../controllers/admin/packs.create.controller.js';
import { deleteAdminPackHandler } from '../../controllers/admin/packs.delete.controller.js';
import { togglePackActiveHandler } from '../../controllers/admin/packs.toggleActive.controller.js';
import { getAdminPackByIdHandler } from '../../controllers/admin/packs.getById.controller.js';
import { saveAdminPackHandler } from '../../controllers/admin/packs.save.controller.js';
import { publishAdminPackHandler } from '../../controllers/admin/packs.publish.controller.js';
import { unpublishAdminPackHandler } from '../../controllers/admin/packs.unpublish.controller.js';
import { getPackProbabilities } from '../../controllers/admin/packs.probabilities.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', listAdminPacksHandler);
router.post('/', createAdminPackHandler);
router.get('/:id/probabilities', getPackProbabilities);
router.get('/:id', getAdminPackByIdHandler);
router.patch('/:id/toggle-active', togglePackActiveHandler);
router.put('/:id', saveAdminPackHandler);
router.post('/:id/publish', publishAdminPackHandler);
router.post('/:id/unpublish', unpublishAdminPackHandler);
router.delete('/:id', deleteAdminPackHandler);

export default router;
