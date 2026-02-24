import { Router } from 'express';
import { requireAuth } from '../middleware/index.js';
import { listAddresses } from '../controllers/shipping-addresses/list.controller.js';
import { createAddress } from '../controllers/shipping-addresses/create.controller.js';
import { getAddress } from '../controllers/shipping-addresses/getOne.controller.js';
import { updateAddress } from '../controllers/shipping-addresses/update.controller.js';
import { deleteAddress } from '../controllers/shipping-addresses/delete.controller.js';

const router = Router();

router.get('/', requireAuth, listAddresses);
router.post('/', requireAuth, createAddress);
router.get('/:id', requireAuth, getAddress);
router.patch('/:id', requireAuth, updateAddress);
router.delete('/:id', requireAuth, deleteAddress);

export default router;
