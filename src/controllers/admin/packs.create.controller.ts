import type { Request, Response, NextFunction } from 'express';
import { createAdminPack } from '../../services/admin-packs.service.js';

/**
 * POST /v1/admin/packs
 * Create a new pack (draft). Body: { name, slug, game_code }.
 */
export async function createAdminPackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, slug, game_code } = req.body ?? {};
    if (!name || !slug || !game_code) {
      res.status(400).json({
        error: 'Missing required fields: name, slug, game_code',
      });
      return;
    }
    const { id } = await createAdminPack({ name, slug, game_code });
    res.status(201).json({ success: true, packId: id });
  } catch (err) {
    next(err);
  }
}
