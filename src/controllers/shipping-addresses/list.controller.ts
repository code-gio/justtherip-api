import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function listAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const admin = getSupabaseAdmin();
    const { data: addresses, error } = await admin
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: 'Failed to fetch shipping addresses' });
      return;
    }
    res.status(200).json({ addresses: addresses ?? [] });
  } catch (err) {
    next(err);
  }
}
