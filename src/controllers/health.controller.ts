import { Request, Response, NextFunction } from 'express';
import { getHealth } from '../services/health.service.js';

export function getHealthHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const result = getHealth();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
