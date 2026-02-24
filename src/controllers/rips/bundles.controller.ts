import type { Request, Response, NextFunction } from 'express';
import { getRipBundles } from '../../services/rips.service.js';

export async function getBundles(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const bundles = await getRipBundles();
    res.status(200).json({ bundles: bundles ?? [] });
  } catch (err) {
    next(err);
  }
}
