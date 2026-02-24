import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const VALID_TABLES = ['mtg_cards', 'pokemon_cards', 'yugioh_cards'];
const MAX_CARDS = 500;

export async function adminBulkVerify(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { table, card_names } = req.body as { table?: string; card_names?: string[] | string };
    if (!table || !card_names) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    if (!VALID_TABLES.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }
    const arr = Array.isArray(card_names) ? card_names : String(card_names).split('\n');
    const cleaned = arr.map((n: string) => n.trim()).filter((n: string) => n.length > 0);
    if (cleaned.length > MAX_CARDS) {
      res.status(400).json({ error: 'Maximum 500 cards can be verified at once' });
      return;
    }
    const admin = getSupabaseAdmin();
    const found: unknown[] = [];
    const notFound: string[] = [];
    const seen = new Set<string>();
    for (const name of cleaned) {
      const { data: exact } = await admin.from(table).select('*').ilike('name', name).limit(5);
      let matched: unknown = null;
      if (exact?.length) matched = exact.find((c: { name?: string }) => c.name?.toLowerCase() === name.toLowerCase()) ?? exact[0];
      if (!matched) {
        const { data: fuzzy } = await admin.from(table).select('*').ilike('name', `%${name}%`).limit(5);
        if (fuzzy?.length) matched = fuzzy.find((c: { name?: string }) => c.name?.toLowerCase() === name.toLowerCase()) ?? fuzzy[0];
      }
      if (matched && !seen.has((matched as { id: string }).id)) {
        seen.add((matched as { id: string }).id);
        found.push(matched);
      } else if (!matched) notFound.push(name);
    }
    res.status(200).json({ found, notFound });
  } catch (err) {
    next(err);
  }
}
