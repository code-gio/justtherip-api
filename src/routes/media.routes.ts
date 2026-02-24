import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/index.js';
import { listFolders, createFolderHandler } from '../controllers/media/folders.controller.js';
import { listAssets, getAsset, deleteAsset } from '../controllers/media/assets.controller.js';
import { uploadAsset } from '../controllers/media/upload.controller.js';
import { getCount } from '../controllers/media/count.controller.js';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get('/folders', requireAuth, listFolders);
router.post('/folders', requireAuth, createFolderHandler);
router.get('/assets', requireAuth, listAssets);
router.get('/assets/:id', requireAuth, getAsset);
router.delete('/assets/:id', requireAuth, deleteAsset);
router.post('/upload', requireAuth, upload.single('file'), uploadAsset);
router.get('/count', requireAuth, getCount);

export default router;
