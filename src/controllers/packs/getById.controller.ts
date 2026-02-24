import type { Request, Response, NextFunction } from 'express';
import { getPackById } from '../../services/packs.service.js';

/**
 * GET /v1/packs/:id
 * Returns pack detail with cards, probabilities, floor/ev/ceiling.
 * If authenticated, also returns balance and sellbackRate.
 */
export async function getPackByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packId = req.params.id ?? req.params.packId;
    if (!packId) {
      res.status(400).json({ error: 'Pack ID is required' });
      return;
    }

    const userId = req.user?.id;
    const result = await getPackById(packId, userId);

    if (!result) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
