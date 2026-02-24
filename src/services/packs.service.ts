import { getSupabaseAdmin } from '../lib/supabase.js';
import { getUserRipBalance } from './rips.service.js';
import { getSystemConfigValue } from './system-config.service.js';
import { calculatePackCardProbabilities } from './card-draw.service.js';

function extractCardImageUrl(imageUri: unknown): string | null {
  if (!imageUri) return null;
  if (typeof imageUri === 'string') {
    try {
      const parsed = JSON.parse(imageUri) as Record<string, string>;
      if (typeof parsed === 'object') {
        return parsed.normal ?? parsed.large ?? parsed.png ?? parsed.small ?? null;
      }
      return imageUri;
    } catch {
      return imageUri;
    }
  }
  if (typeof imageUri === 'object' && imageUri !== null) {
    const o = imageUri as Record<string, string>;
    return o.normal ?? o.large ?? o.png ?? o.small ?? null;
  }
  return null;
}

export interface PackTopCard {
  id: string;
  name: string;
  image_url: string | null;
  market_value: number;
}

export interface PackForSale {
  id: string;
  name: string;
  image: string | null;
  price: number;
  game_code: string;
  topCards: PackTopCard[];
}

export interface ActivePacksResult {
  packs: PackForSale[];
  balance: number | null;
}

/**
 * Fetch active (published) packs with top 3 cards each.
 * If userId is provided, also returns that user's Rip balance.
 */
export async function getActivePacksWithTopCards(
  userId?: string
): Promise<ActivePacksResult> {
  const admin = getSupabaseAdmin();

  const balancePromise = userId ? getUserRipBalance(userId) : Promise.resolve(null);

  const { data: packsData, error: packsError } = await admin
    .from('packs')
    .select('id, name, image_url, rip_cost, game_code')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (packsError) {
    console.error('Error fetching packs:', packsError);
    const balance = await balancePromise;
    return { packs: [], balance };
  }

  const rows = (packsData ?? []) as Array<{
    id: string;
    name: string;
    image_url: string | null;
    rip_cost: number;
    game_code: string;
  }>;

  const packsWithCards: PackForSale[] = await Promise.all(
    rows.map(async (pack) => {
      const packItem: PackForSale = {
        id: pack.id,
        name: pack.name,
        image: pack.image_url ?? null,
        price: pack.rip_cost,
        game_code: pack.game_code ?? '',
        topCards: [],
      };

      if (pack.game_code) {
        try {
          const { data: packCardsResult } = await admin
            .from('pack_cards')
            .select('card_uuid, market_value')
            .eq('pack_id', pack.id)
            .order('market_value', { ascending: false })
            .limit(3);

          if (packCardsResult && packCardsResult.length > 0) {
            const cardTable = `${pack.game_code}_cards`;
            const cardUuids = packCardsResult.map(
              (pc: { card_uuid: string }) => pc.card_uuid
            );

            const { data: cardsData } = await admin
              .from(cardTable)
              .select('id, name, image_uri')
              .in('id', cardUuids);

            if (cardsData) {
              const cardDataMap = new Map<string, { id: string; name?: string; image_uri?: unknown }>();
              for (const card of cardsData as Array<{ id: string; name?: string; image_uri?: unknown }>) {
                let imageUri = card.image_uri;
                if (typeof imageUri === 'string') {
                  try {
                    imageUri = JSON.parse(imageUri) as Record<string, string>;
                  } catch {
                    // keep as string
                  }
                }
                cardDataMap.set(card.id, { ...card, image_uri: imageUri });
              }

              packItem.topCards = packCardsResult
                .map((pc: { card_uuid: string; market_value: number }) => {
                  const cardData = cardDataMap.get(pc.card_uuid);
                  if (!cardData) return null;
                  return {
                    id: cardData.id,
                    name: cardData.name ?? 'Unknown Card',
                    image_url: extractCardImageUrl(cardData.image_uri),
                    market_value: pc.market_value,
                  };
                })
                .filter((c): c is PackTopCard => c !== null);
            }
          }
        } catch (err) {
          console.error(`Error fetching cards for pack ${pack.id}:`, err);
        }
      }

      return packItem;
    })
  );

  const balance = await balancePromise;
  return { packs: packsWithCards, balance };
}

// --- Pack by ID (detail page) ---

export interface PackCardDetail {
  id: string;
  name: string;
  image_uri?: unknown;
  prices?: unknown;
  set_code?: string | null;
  set_name?: string | null;
  rarity?: string | null;
  is_foil?: boolean;
  market_value: number;
  probability: number;
}

export interface PackDetailResult {
  pack: {
    id: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    image_url?: string | null;
    game_code: string;
    rip_cost: number;
    total_openings?: number;
    cards: PackCardDetail[];
    topCards: PackTopCard[];
    floor: number;
    ev: number;
    ceiling: number;
    totalCards: number;
  };
  balance: number | null;
  sellbackRate: number;
}

/**
 * Fetch a single active pack by id with all cards, probabilities, floor/ev/ceiling.
 * If userId is provided, also returns balance and sellback_rate from system config.
 */
export async function getPackById(
  packId: string,
  userId?: string
): Promise<PackDetailResult | null> {
  const admin = getSupabaseAdmin();
  console.log('userId', userId);

  const [packResult, balance, sellbackRaw] = await Promise.all([
    admin
      .from('packs')
      .select('*')
      .eq('id', packId)
      .eq('is_active', true)
      .single(),
    userId ? getUserRipBalance(userId) : Promise.resolve(null),
    getSystemConfigValue('sellback_rate'),
  ]);

  if (packResult.error || !packResult.data) return null;

  const pack = packResult.data as Record<string, unknown>;
  const sellbackRate =
    sellbackRaw != null && Number.isFinite(Number(sellbackRaw))
      ? Number(sellbackRaw)
      : 85;

  const allCards: PackCardDetail[] = [];
  let topCards: PackTopCard[] = [];
  let floor = 0;
  let ev = 0;
  let ceiling = 0;
  const gameCode = (pack.game_code as string) ?? '';

  if (gameCode) {
    const { data: packCardsResult } = await admin
      .from('pack_cards')
      .select('*')
      .eq('pack_id', packId);

    if (packCardsResult?.length) {
      const cardTable = `${gameCode}_cards`;
      const cardUuids = packCardsResult.map((pc: { card_uuid: string }) => pc.card_uuid);

      const { data: cardsData } = await admin
        .from(cardTable)
        .select('id, name, image_uri, prices, set_code, set_name, rarity')
        .in('id', cardUuids);

      if (cardsData?.length) {
        const cardDataMap = new Map<string, Record<string, unknown>>();
        for (const card of cardsData as Array<Record<string, unknown>>) {
          let imageUri = card.image_uri;
          if (typeof imageUri === 'string') {
            try {
              imageUri = JSON.parse(imageUri) as Record<string, string>;
            } catch {
              // keep as string
            }
          }
          cardDataMap.set((card.id as string) ?? '', { ...card, image_uri: imageUri });
        }

        const probabilities = await calculatePackCardProbabilities(packId);
        const probabilityMap = new Map<string, number>();
        for (const p of probabilities) {
          if (p.card_uuid != null) probabilityMap.set(p.card_uuid, p.probability ?? 0);
        }

        for (const pc of packCardsResult as Array<{ card_uuid: string; market_value?: number; is_foil?: boolean }>) {
          const cardData = cardDataMap.get(pc.card_uuid);
          if (!cardData) continue;
          const probability = probabilityMap.get(pc.card_uuid) ?? 0;
          allCards.push({
            id: (cardData.id as string) ?? '',
            name: (cardData.name as string) ?? 'Unknown',
            image_uri: cardData.image_uri,
            prices: cardData.prices,
            set_code: (cardData.set_code as string) ?? null,
            set_name: (cardData.set_name as string) ?? null,
            rarity: (cardData.rarity as string) ?? null,
            is_foil: (pc as { is_foil?: boolean }).is_foil,
            market_value: pc.market_value ?? 0,
            probability,
          });
        }

        if (allCards.length > 0) {
          const values = allCards.map((c) => c.market_value || 0);
          floor = Math.min(...values);
          ceiling = Math.max(...values);
          ev = allCards.reduce((sum, c) => sum + (c.probability || 0) * (c.market_value || 0), 0);
          topCards = allCards
            .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
            .slice(0, 3)
            .map((card) => ({
              id: card.id,
              name: card.name ?? 'Unknown Card',
              image_url: extractCardImageUrl(card.image_uri),
              market_value: card.market_value,
            }));
        }
      }
    }
  }

  return {
    pack: {
      id: (pack.id as string) ?? packId,
      name: (pack.name as string) ?? '',
      slug: (pack.slug as string) ?? null,
      description: (pack.description as string) ?? null,
      image_url: (pack.image_url as string) ?? null,
      game_code: gameCode,
      rip_cost: (pack.rip_cost as number) ?? 0,
      total_openings: (pack.total_openings as number) ?? 0,
      cards: allCards,
      topCards,
      floor,
      ev,
      ceiling,
      totalCards: allCards.length,
    },
    balance,
    sellbackRate,
  };
}
