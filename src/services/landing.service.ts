import { getSupabaseAdmin } from '../lib/supabase.js';
import { getSystemConfigValue } from './system-config.service.js';
import { getSignedAvatarUrl } from '../lib/storage.js';

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

export interface LandingTopCard {
  id: string;
  name: string;
  image_url: string | null;
  market_value: number;
}

export interface LandingTopPack {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  game_code: string;
  rip_cost: number;
  total_openings: number;
  topCards: LandingTopCard[];
}

export interface LandingGame {
  id: string;
  name: string;
  code: string;
}

export interface PacksByGameItem {
  game_code: string;
  packs: number;
}

export interface LandingProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface LandingPull {
  id: string;
  card_name: string | null;
  card_image_url: string | null;
  card_value_cents: number | null;
  created_at: string;
  game_code: string | null;
  rarity: string | null;
  is_foil: boolean | null;
  user_id: string;
  profile: LandingProfile | null;
}

export interface LandingDataOptions {
  topPacksLimit: number;
  recentPullsLimit: number;
  rarePullsLimit: number;
  mythicPullsLimit: number;
  topCardsPerPack: number;
}

export interface LandingData {
  games: LandingGame[];
  topPacks: LandingTopPack[];
  recentPulls: LandingPull[];
  rarePulls: LandingPull[];
  packsByGame: PacksByGameItem[];
}

const DEFAULT_OPTIONS: LandingDataOptions = {
  topPacksLimit: 4,
  recentPullsLimit: 50,
  rarePullsLimit: 20,
  mythicPullsLimit: 25,
  topCardsPerPack: 3,
};

/**
 * Process profiles: resolve avatar_url to signed URLs where applicable.
 */
async function processProfilesWithAvatars(
  profiles: Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>
): Promise<LandingProfile[]> {
  return Promise.all(
    profiles.map(async (p) => ({
      id: p.id,
      username: p.username ?? null,
      display_name: p.display_name ?? null,
      avatar_url: await getSignedAvatarUrl(p.avatar_url),
    }))
  );
}

/**
 * Fetch all public data for the landing page: games, top packs by openings,
 * recent pulls, rare pulls, and packs count by game.
 */
export async function getLandingData(
  options: Partial<LandingDataOptions> = {}
): Promise<LandingData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const admin = getSupabaseAdmin();

  const carouselMinUsd = Number(await getSystemConfigValue('carousel_min_value_usd'));
  const carouselMinCents =
    Number.isFinite(carouselMinUsd) && carouselMinUsd >= 0 ? carouselMinUsd * 100 : 0;
  // console.log('carouselMinCents', carouselMinCents);

  // Games
  const { data: gamesData } = await admin
    .from('games')
    .select('id, name, code')
    .order('name');
  const games: LandingGame[] = (gamesData ?? []).map((g: { id: string; name: string; code: string }) => ({
    id: g.id,
    name: g.name,
    code: g.code,
  }));

  // Pack openings count to get top pack IDs
  const { data: packOpeningsData } = await admin.from('pack_openings').select('pack_id');
  const openingsMap = new Map<string, number>();
  (packOpeningsData ?? []).forEach((row: { pack_id: string }) => {
    const count = openingsMap.get(row.pack_id) ?? 0;
    openingsMap.set(row.pack_id, count + 1);
  });
  console.log('openingsMap', openingsMap);
  const topPackIds = Array.from(openingsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.topPacksLimit)
    .map(([packId]) => packId);
  console.log('topPackIds', topPackIds);

  // Fetch top packs details and their top cards
  let topPacks: LandingTopPack[] = [];
  if (topPackIds.length > 0) {
    const { data: packsRows } = await admin
      .from('packs')
      .select('id, name, slug, image_url, game_code, rip_cost, total_openings')
      .in('id', topPackIds)
      .eq('is_active', true);

    const packsList = (packsRows ?? []) as Array<{
      id: string;
      name: string;
      slug: string | null;
      image_url: string | null;
      game_code: string;
      rip_cost: number;
      total_openings: number;
    }>;
    packsList.sort(
      (a, b) => topPackIds.indexOf(a.id) - topPackIds.indexOf(b.id)
    );

    topPacks = await Promise.all(
      packsList.map(async (pack) => {
        const item: LandingTopPack = {
          id: pack.id,
          name: pack.name,
          slug: pack.slug ?? null,
          image_url: pack.image_url ?? null,
          game_code: pack.game_code ?? '',
          rip_cost: pack.rip_cost ?? 0,
          total_openings: pack.total_openings ?? 0,
          topCards: [],
        };

        if (pack.game_code) {
          try {
            const { data: packCardsResult } = await admin
              .from('pack_cards')
              .select('card_uuid, market_value')
              .eq('pack_id', pack.id)
              .order('market_value', { ascending: false })
              .limit(opts.topCardsPerPack);

            if (packCardsResult?.length) {
              const cardTable = `${pack.game_code}_cards`;
              const cardUuids = packCardsResult.map((pc: { card_uuid: string }) => pc.card_uuid);
              const { data: cardsData } = await admin
                .from(cardTable)
                .select('id, name, image_uri')
                .in('id', cardUuids);

              if (cardsData?.length) {
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
                item.topCards = packCardsResult
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
                  .filter((c): c is LandingTopCard => c !== null);
              }
            }
          } catch (err) {
            console.error(`Error fetching cards for pack ${pack.id}:`, err);
          }
        }
        return item;
      })
    );
  }

  // Packs by game (active packs only)
  const { data: activePacksData } = await admin
    .from('packs')
    .select('game_code')
    .eq('is_active', true);
  const gameCountMap = new Map<string, number>();
  (activePacksData ?? []).forEach((row: { game_code: string }) => {
    const code = row.game_code ?? '';
    gameCountMap.set(code, (gameCountMap.get(code) ?? 0) + 1);
  });
  const packsByGame: PacksByGameItem[] = Array.from(gameCountMap.entries()).map(
    ([game_code, packs]) => ({ game_code, packs })
  );

  // Recent pulls and rare pulls: fetch inventory rows then enrich with profiles
  const { data: recentRows } = await admin
    .from('user_inventory')
    .select(
      'id, card_name, card_image_url, card_value_cents, created_at, game_code, rarity, is_foil, user_id'
    )
    .order('created_at', { ascending: false })
    .limit(opts.recentPullsLimit);
  console.log('recentRows', recentRows?.length);

  const mythicLimit = opts.mythicPullsLimit || DEFAULT_OPTIONS.mythicPullsLimit;
  const rareLimit = opts.mythicPullsLimit || DEFAULT_OPTIONS.rarePullsLimit;
  const { data: mythicRows } = await admin
    .from('user_inventory')
    .select(
      'id, card_name, card_image_url, card_value_cents, created_at, game_code, rarity, is_foil, user_id'
    )
    .eq('rarity', 'mythic')
    .order('created_at', { ascending: false })
    .limit(mythicLimit);

  const { data: rareRows } = await admin
    .from('user_inventory')
    .select(
      'id, card_name, card_image_url, card_value_cents, created_at, game_code, rarity, is_foil, user_id'
    )
    .eq('rarity', 'rare')
    .order('created_at', { ascending: false })
    .limit(rareLimit);
  console.log('rareRows', rareRows?.length);

  const recentList = (recentRows ?? []) as Array<{
    id: string;
    card_name: string | null;
    card_image_url: string | null;
    card_value_cents: number | null;
    created_at: string;
    game_code: string | null;
    rarity: string | null;
    is_foil: boolean | null;
    user_id: string;
  }>;
  const rareList = [
    ...((mythicRows ?? []) as typeof recentList),
    ...((rareRows ?? []) as typeof recentList),
  ];

  const recentFiltered = recentList.filter(
    (r) => (r.card_value_cents ?? 0) >= carouselMinCents
  );
  const rareFiltered = rareList.filter(
    (r) => (r.card_value_cents ?? 0) >= carouselMinCents
  );

  const allUserIds = new Set<string>();
  recentFiltered.forEach((r) => allUserIds.add(r.user_id));
  rareFiltered.forEach((r) => allUserIds.add(r.user_id));
  const userIds = Array.from(allUserIds);

  let profilesMap = new Map<string, LandingProfile>();
  if (userIds.length > 0) {
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);
    const processed = await processProfilesWithAvatars(profilesData ?? []);
    processed.forEach((p) => profilesMap.set(p.id, p));
  }

  const recentPulls: LandingPull[] = recentFiltered.map((r) => ({
    id: r.id,
    card_name: r.card_name,
    card_image_url: r.card_image_url,
    card_value_cents: r.card_value_cents,
    created_at: r.created_at,
    game_code: r.game_code,
    rarity: r.rarity,
    is_foil: r.is_foil,
    user_id: r.user_id,
    profile: profilesMap.get(r.user_id) ?? null,
  }));

  const rarePulls: LandingPull[] = rareFiltered.map((r) => ({
    id: r.id,
    card_name: r.card_name,
    card_image_url: r.card_image_url,
    card_value_cents: r.card_value_cents,
    created_at: r.created_at,
    game_code: r.game_code,
    rarity: r.rarity,
    is_foil: r.is_foil,
    user_id: r.user_id,
    profile: profilesMap.get(r.user_id) ?? null,
  }));

  // console.log('recentPulls', recentPulls?.length);
  // console.log('rarePulls', rarePulls?.length);
  console.log('topPacks', topPacks?.length);
  // console.log('packsByGame', packsByGame?.length);
  // console.log('games', games?.length);
  // console.log('topPacks', topPacks?.length);

  return {
    games,
    topPacks,
    recentPulls,
    rarePulls,
    packsByGame,
  };
}
