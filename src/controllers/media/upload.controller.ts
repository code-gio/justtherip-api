import type { Request, Response, NextFunction } from 'express';
import { uploadMedia } from '../../services/media.service.js';

export async function uploadAsset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const file = (req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string; size: number } }).file;
    if (!file?.buffer) {
      res.status(400).json({ error: 'Missing required field: file' });
      return;
    }
    const folderId = (req.body?.folderId as string) ?? null;
    const breadcrumbs = req.body?.breadcrumbs ? (typeof req.body.breadcrumbs === 'string' ? JSON.parse(req.body.breadcrumbs) : req.body.breadcrumbs) : [];
    const tags = req.body?.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [];
    const description = (req.body?.description as string) ?? undefined;
    const result = await uploadMedia({
      userId,
      folderId,
      breadcrumbs,
      tags,
      description,
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    });
    if (!result.success) {
      res.status(500).json({ error: result.error ?? result.message });
      return;
    }
    res.status(200).json({ success: true, asset: result.asset ?? null });
  } catch (err) {
    next(err);
  }
}
