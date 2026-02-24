import type { Request, Response, NextFunction } from 'express';
import { getActivePacksWithTopCards } from '../../services/packs.service.js';

/**
 * GET /v1/packs
 * Returns active (published) packs with top 3 cards each.
 * If the user is authenticated, also returns their Rip balance.
 */
export async function listPacks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { packs, balance } = await getActivePacksWithTopCards(userId);

    const payload: { packs: typeof packs; balance?: number } = { packs };
    if (balance !== null) {
      payload.balance = balance;
    }

    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
}
