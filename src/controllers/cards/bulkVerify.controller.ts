import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const VALID_TABLES = ['mtg_cards', 'pokemon_cards', 'yugioh_cards'];
const MAX_CARDS = 500;

export async function bulkVerify(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { table, card_names, game_code } = req.body as {
      table?: string;
      card_names?: string[] | string;
      game_code?: string;
    };
    if (!table || !card_names) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    if (!VALID_TABLES.includes(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }
    const cardNamesArray = Array.isArray(card_names) ? card_names : String(card_names).split('\n');
    const cleanedNames = cardNamesArray.map((n: string) => n.trim()).filter((n: string) => n.length > 0);
    if (cleanedNames.length === 0) {
      res.status(200).json({ found: [], notFound: [] });
      return;
    }
    if (cleanedNames.length > MAX_CARDS) {
      res.status(400).json({ error: 'Maximum 500 cards can be verified at once' });
      return;
    }

    const admin = getSupabaseAdmin();
    const found: unknown[] = [];
    const notFound: string[] = [];
    const seenIds = new Set<string>();

    for (const cardName of cleanedNames) {
      const { data: exactMatch } = await admin
        .from(table)
        .select('*')
        .ilike('name', cardName)
        .limit(5);
      let matched = null;
      if (exactMatch?.length) {
        const lower = cardName.toLowerCase();
        matched = exactMatch.find((c: { name?: string }) => c.name?.toLowerCase() === lower) ?? exactMatch[0];
      }
      if (!matched) {
        const { data: fuzzy } = await admin
          .from(table)
          .select('*')
          .ilike('name', `%${cardName}%`)
          .limit(5);
        if (fuzzy?.length) {
          const lower = cardName.toLowerCase();
          matched = fuzzy.find((c: { name?: string }) => c.name?.toLowerCase() === lower) ?? fuzzy[0];
        }
      }
      if (matched && !seenIds.has((matched as { id: string }).id)) {
        seenIds.add((matched as { id: string }).id);
        found.push(matched);
      } else if (!matched) {
        notFound.push(cardName);
      }
    }
    res.status(200).json({ found, notFound });
  } catch (err) {
    next(err);
  }
}
