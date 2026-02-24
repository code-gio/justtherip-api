import type { Request, Response, NextFunction } from 'express';
import { getMediaAssets, getMediaAsset, deleteMediaAsset } from '../../services/media.service.js';

export async function listAssets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const folderIdParam = req.query.folderId;
    const folderId = folderIdParam === 'null' || folderIdParam === '' ? null : (folderIdParam as string);
    const assets = await getMediaAssets(userId, folderId ?? null);
    res.status(200).json({ assets });
  } catch (err) {
    next(err);
  }
}

export async function getAsset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const asset = await getMediaAsset(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.status(200).json({ asset });
  } catch (err) {
    next(err);
  }
}

export async function deleteAsset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await deleteMediaAsset(req.params.id);
    if (!result.success) {
      res.status(500).json({ error: result.error ?? result.message });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
