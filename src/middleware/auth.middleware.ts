import type { Request, Response, NextFunction } from 'express';
import { getSessionFromRequest, requireAdmin as requireAdminService } from '../services/auth.service.js';
import type { AuthUser } from '../services/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Attach user to req if valid Bearer token present. Does not reject.
 */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const { user } = await getSessionFromRequest(req);
  if (user) req.user = user;
  next();
}

/**
 * Require authentication. Responds 401 if no valid user.
 * Client must send: Authorization: Bearer <supabase_access_token>
 * And SUPABASE_JWT_SECRET must be set in .env (Supabase Dashboard → API → JWT Secret).
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { user } = await getSessionFromRequest(req);
  if (!user) {
    const hasHeader = req.headers.authorization?.startsWith('Bearer ');
    res.status(401).json({
      error: 'Unauthorized',
      hint: hasHeader
        ? 'Invalid or expired token, or SUPABASE_JWT_SECRET mismatch. Check .env and use a fresh token from supabase.auth.getSession().'
        : 'Missing Authorization: Bearer <token> header.',
    });
    return;
  }
  req.user = user;
  next();
}

/**
 * Require admin. Use after requireAuth. Responds 403 if not admin.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    await requireAdminService(req.user.id);
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 403).json({ error: e.message ?? 'Forbidden' });
  }
}
