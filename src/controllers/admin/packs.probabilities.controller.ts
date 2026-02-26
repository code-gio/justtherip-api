import type { Request, Response, NextFunction } from 'express';
import { calculatePackCardProbabilities } from '../../services/card-draw.service.js';

export async function getPackProbabilities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packId = req.params.packId ?? req.params.id;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    const probabilities = await calculatePackCardProbabilities(packId);
    res.status(200).json({ probabilities });
  } catch (err) {
    next(err);
  }
}
