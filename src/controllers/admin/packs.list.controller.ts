import type { Request, Response, NextFunction } from 'express';
import { listAdminPacks } from '../../services/admin-packs.service.js';

/**
 * GET /v1/admin/packs
 * List packs for admin (is_archive = false) with game info.
 */
export async function listAdminPacksHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packs = await listAdminPacks();
    res.status(200).json({ packs });
  } catch (err) {
    next(err);
  }
}
