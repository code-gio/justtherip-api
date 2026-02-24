import { getSupabaseAdmin } from '../lib/supabase.js';

export interface DrawnCard {
  card_uuid: string;
  value_cents: number;
  card_name: string;
  card_image_url: string | null;
  set_name: string | null;
  set_code: string | null;
  rarity: string | null;
  is_foil?: boolean;
  condition?: string;
}

export interface DrawCardResult {
  success: boolean;
  card?: DrawnCard;
  error?: string;
}

/** Sell-back rate (e.g. 85% of card value as Rips). */
const SELLBACK_RATE = 0.85;

/**
 * Calculate sell-back value in Rips (85% of card value in cents, as Rips).
 */
export function calculateSellbackValue(cardValueCents: number): number {
  return Math.floor(cardValueCents * SELLBACK_RATE / 100);
}

/**
 * Draw a card from a pack using pack probabilities/card pool.
 * Uses pack_card_tiers or pack_cards table for weighted selection.
 */
export async function drawCardFromPack(
  packId: string,
  _userId: string
): Promise<DrawCardResult> {
  const admin = getSupabaseAdmin();

  const { data: pack, error: packError } = await admin
    .from('packs')
    .select('id, game_code')
    .eq('id', packId)
    .single();

  if (packError || !pack) {
    return { success: false, error: 'Pack not found' };
  }

  const gameCode = (pack as { game_code?: string }).game_code ?? 'mtg';
  const cardsTable = gameCode === 'mtg' ? 'mtg_cards' : gameCode === 'pokemon' ? 'pokemon_cards' : 'mtg_cards';

  // Try pack_card_tiers: pack_id, tier/card reference, weight
  const { data: tierRows } = await admin
    .from('pack_card_tiers')
    .select('card_tier_id, weight')
    .eq('pack_id', packId);

  if (tierRows && tierRows.length > 0) {
    const totalWeight = tierRows.reduce((s: number, r: { weight?: number }) => s + (Number(r.weight) || 1), 0);
    let r = Math.random() * totalWeight;
    for (const row of tierRows as { card_tier_id: string; weight?: number }[]) {
      const w = Number(row.weight) ?? 1;
      if (r <= w) {
        const { data: card } = await admin
          .from(cardsTable)
          .select('id, name, image_uris, set_name, set, rarity, prices, foil')
          .eq('id', row.card_tier_id)
          .limit(1)
          .maybeSingle();
        if (card) {
          const c = card as Record<string, unknown>;
          const valueCents = typeof c.prices === 'object' && c.prices && typeof (c.prices as Record<string, unknown>).usd === 'string'
            ? Math.round(parseFloat((c.prices as { usd?: string }).usd ?? '0') * 100)
            : 0;
          return {
            success: true,
            card: {
              card_uuid: (c.id as string) ?? '',
              value_cents: valueCents,
              card_name: (c.name as string) ?? 'Unknown',
              card_image_url: (c.image_uris as { normal?: string })?.normal ?? null,
              set_name: (c.set_name as string) ?? null,
              set_code: (c.set as string) ?? null,
              rarity: (c.rarity as string) ?? null,
              is_foil: (c.foil as boolean) ?? false,
              condition: 'NM',
            },
          };
        }
        r -= w;
        continue;
      }
      r -= w;
    }
  }

  // Fallback: pick any card from pack's card pool (e.g. pack_cards table)
  const { data: packCards } = await admin
    .from('pack_cards')
    .select('card_id, weight')
    .eq('pack_id', packId);

  if (packCards && packCards.length > 0) {
    const total = packCards.reduce((s: number, r: { weight?: number }) => s + (Number((r as { weight?: number }).weight) || 1), 0);
    let r = Math.random() * total;
    for (const row of packCards as { card_id: string; weight?: number }[]) {
      const w = Number(row.weight) ?? 1;
      if (r <= w) {
        const { data: card } = await admin
          .from(cardsTable)
          .select('*')
          .eq('id', row.card_id)
          .limit(1)
          .maybeSingle();
        if (card) {
          const c = card as Record<string, unknown>;
          const valueCents = typeof c.prices === 'object' && c.prices && typeof (c.prices as Record<string, unknown>).usd === 'string'
            ? Math.round(parseFloat((c.prices as { usd?: string }).usd ?? '0') * 100)
            : 0;
          return {
            success: true,
            card: {
              card_uuid: (c.id as string) ?? '',
              value_cents: valueCents,
              card_name: (c.name as string) ?? 'Unknown',
              card_image_url: (c.image_uris as { normal?: string })?.normal ?? null,
              set_name: (c.set_name as string) ?? null,
              set_code: (c.set as string) ?? null,
              rarity: (c.rarity as string) ?? null,
              is_foil: (c.foil as boolean) ?? false,
              condition: 'NM',
            },
          };
        }
      }
      r -= w;
    }
  }

  return { success: false, error: 'No cards in pack or draw failed' };
}

export interface PackCardProbability {
  card_id?: string;
  card_uuid?: string;
  card_name?: string;
  tier?: string;
  weight?: number;
  probability?: number;
  [key: string]: unknown;
}

/**
 * Calculate probabilities for all cards in a pack (for admin/simulator).
 * Uses pack_card_tiers or pack_cards table.
 */
export async function calculatePackCardProbabilities(packId: string): Promise<PackCardProbability[]> {
  const admin = getSupabaseAdmin();
  const { data: tierRows } = await admin.from('pack_card_tiers').select('*').eq('pack_id', packId);
  if (tierRows?.length) {
    const total = tierRows.reduce((s: number, r: { weight?: number }) => s + (Number((r as { weight?: number }).weight) || 1), 0);
    return tierRows.map((r: Record<string, unknown>) => ({
      ...r,
      probability: total > 0 ? (Number(r.weight) || 1) / total : 0,
    })) as PackCardProbability[];
  }
  const { data: packCards } = await admin.from('pack_cards').select('card_uuid, weight').eq('pack_id', packId);
  if (!packCards?.length) return [];
  const total = packCards.reduce((s: number, r: { weight?: number }) => s + (Number((r as { weight?: number }).weight) || 1), 0);
  return packCards.map((r: Record<string, unknown>) => ({
    card_uuid: r.card_uuid,
    weight: r.weight,
    probability: total > 0 ? (Number(r.weight) || 1) / total : 0,
  })) as PackCardProbability[];
}
