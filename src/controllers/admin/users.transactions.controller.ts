import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function getUserTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('rip_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      res.status(500).json({ error: 'Failed to fetch transactions' });
      return;
    }
    res.status(200).json({ transactions: data ?? [] });
  } catch (err) {
    next(err);
  }
}
