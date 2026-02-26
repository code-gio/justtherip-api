import type { Request, Response, NextFunction } from 'express';
import { togglePackActive } from '../../services/admin-packs.service.js';

/**
 * PATCH /v1/admin/packs/:id/toggle-active
 * Toggle pack is_active (activate / deactivate).
 */
export async function togglePackActiveHandler(
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
    const result = await togglePackActive(packId);
    res.status(200).json({ success: true, is_active: result.is_active });
  } catch (err) {
    if ((err as Error).message === 'Pack not found') {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    next(err);
  }
}
