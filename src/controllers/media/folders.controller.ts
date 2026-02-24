import type { Request, Response, NextFunction } from 'express';
import { getFolders, createFolder } from '../../services/media.service.js';

export async function listFolders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const parentIdParam = req.query.parentId;
    const parentId = parentIdParam === 'null' || parentIdParam === '' ? null : (parentIdParam as string);
    const folders = await getFolders(userId, parentId ?? null);
    res.status(200).json({ folders });
  } catch (err) {
    next(err);
  }
}

export async function createFolderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { name, parentId, breadcrumbs } = req.body as { name?: string; parentId?: string; breadcrumbs?: unknown[] };
    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }
    const result = await createFolder({
      userId,
      name,
      parentId: parentId ?? null,
      breadcrumbs: breadcrumbs ?? [],
    });
    if (!result.success) {
      res.status(500).json({ error: result.error ?? result.message });
      return;
    }
    res.status(200).json({ success: true, folder: result.folder });
  } catch (err) {
    next(err);
  }
}
