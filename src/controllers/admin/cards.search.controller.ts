import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const CARDS_PER_PAGE = 50;
const TABLE_NOT_FOUND_CODE = 'PGRST205';

export async function adminSearchCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameCode = req.query.game_code as string;
    const searchQuery = (req.query.search as string)?.trim() ?? '';
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const minValueCents = parseInt(String(req.query.min_value_cents), 10) || 0;
    const maxValueCents = parseInt(String(req.query.max_value_cents), 10) || 999999999;
    const packId = req.query.pack_id as string | undefined;

    if (!gameCode) {
      res.status(400).json({ error: 'game_code is required' });
      return;
    }
    const tableName = `${gameCode}_cards`;
    const admin = getSupabaseAdmin();
    const { error: tableCheckError } = await admin.from(tableName).select('id').limit(1);
    if (tableCheckError?.code === TABLE_NOT_FOUND_CODE) {
      res.status(200).json({ cards: [], total: 0, page, perPage: CARDS_PER_PAGE, hasMore: false, catalogUnavailable: true });
      return;
    }
    if (tableCheckError) {
      res.status(500).json({ error: 'Failed to fetch cards' });
      return;
    }

    const offset = (page - 1) * CARDS_PER_PAGE;
    let assignedCardIds: string[] = [];
    if (packId) {
      const { data: assigned } = await admin.from('pack_cards').select('card_uuid').eq('pack_id', packId);
      assignedCardIds = (assigned ?? []).map((a: { card_uuid: string }) => a.card_uuid);
    }

    let query = admin.from(tableName).select('*', { count: 'exact' });
    if (gameCode === 'mtg') {
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      const { data: cards, error: cardsError } = await query.order('name', { ascending: true }).limit(200);
      if (cardsError) {
        if (cardsError.code === TABLE_NOT_FOUND_CODE) {
          res.status(200).json({ cards: [], total: 0, page, perPage: CARDS_PER_PAGE, hasMore: false, catalogUnavailable: true });
          return;
        }
        res.status(500).json({ error: 'Failed to fetch cards' });
        return;
      }
      const filtered = (cards ?? []).filter((card: { prices?: { usd?: string; usd_foil?: string }; id?: string }) => {
        const prices = card.prices ?? {};
        const priceCents = Math.max(parseFloat(prices.usd ?? '0'), parseFloat(prices.usd_foil ?? '0')) * 100;
        return priceCents >= minValueCents && priceCents <= maxValueCents && (!assignedCardIds.length || !assignedCardIds.includes(card.id!));
      });
      const sorted = filtered.sort((a: { prices?: { usd?: string; usd_foil?: string } }, b: { prices?: { usd?: string; usd_foil?: string } }) => {
        const aP = Math.max(parseFloat(a.prices?.usd ?? '0'), parseFloat(a.prices?.usd_foil ?? '0'));
        const bP = Math.max(parseFloat(b.prices?.usd ?? '0'), parseFloat(b.prices?.usd_foil ?? '0'));
        return bP - aP;
      });
      const paginated = sorted.slice(offset, offset + CARDS_PER_PAGE);
      res.status(200).json({ cards: paginated, total: sorted.length, page, perPage: CARDS_PER_PAGE, hasMore: offset + CARDS_PER_PAGE < sorted.length });
      return;
    }

    query = query.gte('market_value_cents', minValueCents).lte('market_value_cents', maxValueCents);
    if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
    if (assignedCardIds.length > 0) query = query.not('id', 'in', `(${assignedCardIds.join(',')})`);
    const { data: cards, error: cardsError, count } = await query.order('market_value_cents', { ascending: false }).range(offset, offset + CARDS_PER_PAGE - 1);
    if (cardsError) {
      res.status(500).json({ error: 'Failed to fetch cards' });
      return;
    }
    res.status(200).json({ cards: cards ?? [], total: count ?? 0, page, perPage: CARDS_PER_PAGE, hasMore: (count ?? 0) > offset + CARDS_PER_PAGE });
  } catch (err) {
    next(err);
  }
}
