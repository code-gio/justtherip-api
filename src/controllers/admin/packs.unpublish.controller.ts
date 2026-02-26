import type { Request, Response, NextFunction } from 'express';
import { unpublishAdminPack } from '../../services/admin-packs.service.js';

/**
 * POST /v1/admin/packs/:id/unpublish
 * Unpublish pack: set is_active = false.
 */
export async function unpublishAdminPackHandler(
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
    await unpublishAdminPack(packId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
