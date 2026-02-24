import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/configuration.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

export interface AuthUser {
  id: string;
  email?: string;
}

const JWT_OPTIONS: jwt.VerifyOptions = { algorithms: ['HS256'] };

/**
 * Get authenticated user from request (Authorization: Bearer <token>).
 * Verifies Supabase JWT and returns user payload or null.
 *
 * Setup:
 * 1. In .env set SUPABASE_JWT_SECRET (from Supabase Dashboard → Project Settings → API → JWT Secret).
 * 2. Send header: Authorization: Bearer <access_token> where access_token is from your Supabase client
 *    (e.g. (await supabase.auth.getSession()).data.session?.access_token).
 */
export async function getSessionFromRequest(req: Request): Promise<{
  user: AuthUser | null;
  session: { access_token: string } | null;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, session: null };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { user: null, session: null };
  }
  if (!config.supabase.jwtSecret) {
    if (config.nodeEnv === 'development') {
      console.warn('[auth] SUPABASE_JWT_SECRET is not set; all authenticated requests will fail. Set it in .env from Supabase Dashboard → Project Settings → API → JWT Secret.');
    }
    return { user: null, session: null };
  }
  try {
    const payload = jwt.verify(token, config.supabase.jwtSecret, JWT_OPTIONS) as {
      sub: string;
      email?: string;
    };
    return {
      user: { id: payload.sub, email: payload.email },
      session: { access_token: token },
    };
  } catch {
    return { user: null, session: null };
  }
}

/**
 * Throws if the user is not an admin. Use after getSessionFromRequest.
 * Checks profiles.role = 'admin' or profiles.is_admin (adjust to your schema).
 */
export async function requireAdmin(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const err = new Error('Failed to verify admin access') as Error & { statusCode?: number };
    err.statusCode = 500;
    throw err;
  }

  const isAdmin =
    profile &&
    ((profile as { role?: string }).role === 'admin' ||
      (profile as { is_admin?: boolean }).is_admin === true);

  if (!isAdmin) {
    const err = new Error('Forbidden') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
}
