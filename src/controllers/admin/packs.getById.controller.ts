import type { Request, Response, NextFunction } from 'express';
import { getAdminPackById } from '../../services/admin-packs.service.js';

/**
 * GET /v1/admin/packs/:id
 * Get pack by id (is_archive = false) with pack_cards and card data.
 */
export async function getAdminPackByIdHandler(
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
    const data = await getAdminPackById(packId);
    if (!data) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
