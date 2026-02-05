import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers[HEADER] as string) ?? randomUUID();
  (req as Request & { requestId: string }).requestId = id;
  res.setHeader(HEADER, id);
  next();
}
