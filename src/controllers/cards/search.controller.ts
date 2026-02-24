import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const VALID_TABLES = ['mtg_cards', 'pokemon_cards', 'yugioh_cards'];

export async function searchCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { table, query, limit = 50 } = req.body as { table?: string; query?: string; limit?: number };
    if (!table || !query) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    if (!VALID_TABLES.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: cards, error } = await admin
      .from(table)
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(Math.min(Number(limit) || 50, 200))
      .order('name');

    if (error) {
      console.error('Card search error:', error);
      res.status(500).json({ error: 'Search failed' });
      return;
    }
    res.status(200).json({ cards: cards ?? [] });
  } catch (err) {
    next(err);
  }
}
