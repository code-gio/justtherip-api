import type { Request, Response, NextFunction } from 'express';
import { deleteAdminPack } from '../../services/admin-packs.service.js';

/**
 * DELETE /v1/admin/packs/:id
 * Delete pack. If it has openings, archive instead (is_archive = true).
 */
export async function deleteAdminPackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packId = req.params.id;
    if (!packId) {
      res.status(400).json({ error: 'Pack id is required' });
      return;
    }
    const result = await deleteAdminPack(packId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
