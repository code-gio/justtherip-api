import type { Request, Response, NextFunction } from 'express';
import { getUserRipBalance } from '../../services/rips.service.js';

export async function getBalance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const balance = await getUserRipBalance(userId);
    if (balance === null) {
      res.status(500).json({ error: 'Failed to fetch balance' });
      return;
    }
    res.status(200).json({ balance, user_id: userId });
  } catch (err) {
    next(err);
  }
}
