import type { Request, Response, NextFunction } from 'express';
import { getAssetCountForFolder } from '../../services/media.service.js';

export async function getCount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const folderId = req.query.folderId as string;
    if (!folderId) {
      res.status(400).json({ error: 'Missing folderId parameter' });
      return;
    }
    const count = await getAssetCountForFolder(folderId);
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}
