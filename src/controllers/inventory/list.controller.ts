import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function listInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const offset = (page - 1) * limit;

    const admin = getSupabaseAdmin();
    const { data: cards, error, count } = await admin
      .from('user_inventory')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_sold', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch inventory' });
      return;
    }
    const totalValueCents = (cards ?? []).reduce(
      (sum: number, c: { card_value_cents?: number }) => sum + (c.card_value_cents ?? 0),
      0
    );
    res.status(200).json({
      cards: cards ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        pages: Math.ceil((count ?? 0) / limit),
      },
      stats: {
        total_cards: count ?? 0,
        total_value_cents: totalValueCents,
        total_value_usd: (totalValueCents / 100).toFixed(2),
      },
    });
  } catch (err) {
    next(err);
  }
}
