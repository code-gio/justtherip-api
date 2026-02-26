import { getSupabaseAdmin } from '../lib/supabase.js';

export interface AdminPackRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  game_code: string;
  rip_cost: number;
  is_active: boolean;
  total_openings: number;
  is_archive?: boolean;
}

export interface AdminPackWithGame extends AdminPackRow {
  game: { name: string; code: string } | null;
}

export interface AdminPackCardRow {
  card_uuid: string;
  market_value: number;
  is_foil: boolean | null;
  condition: string | null;
  card_table: string | null;
  game_code: string | null;
}

export interface AdminPackCardWithData extends AdminPackCardRow {
  cardData: {
    id: string;
    name: string | null;
    image_uri: unknown;
    prices: unknown;
    set_code: string | null;
    set_name: string | null;
    rarity: string | null;
  } | null;
}

export interface AdminPackDetail {
  pack: AdminPackRow;
  packCards: AdminPackCardWithData[];
}

/**
 * List packs for admin (is_archive = false), with game info. Ordered by created_at desc.
 */
export async function listAdminPacks(): Promise<AdminPackWithGame[]> {
  const admin = getSupabaseAdmin();

  const [packsResult, gamesResult] = await Promise.all([
    admin
      .from('packs')
      .select(
        'id, name, slug, description, image_url, game_code, rip_cost, is_active, total_openings'
      )
      .eq('is_archive', false)
      .order('created_at', { ascending: false }),
    admin.from('games').select('id, name, code').order('name'),
  ]);

  if (packsResult.error) {
    console.error('Error fetching admin packs:', packsResult.error);
    throw new Error(packsResult.error.message);
  }
  if (gamesResult.error) {
    console.error('Error fetching games:', gamesResult.error);
  }

  const games = (gamesResult.data ?? []) as Array<{ id: string; name: string; code: string }>;
  const packs = (packsResult.data ?? []) as AdminPackRow[];

  return packs.map((pack) => {
    const game = games.find((g) => g.code === pack.game_code);
    return {
      ...pack,
      game: game ? { name: game.name, code: game.code } : null,
    };
  });
}

/**
 * Create a new pack (draft: is_active false). Returns the created pack id.
 */
export async function createAdminPack(body: {
  name: string;
  slug: string;
  game_code: string;
}): Promise<{ id: string }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('packs')
    .insert({
      name: body.name,
      slug: body.slug,
      game_code: body.game_code,
      rip_cost: 1,
      is_active: false,
      total_openings: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating pack:', error);
    throw new Error(error.message);
  }
  return { id: (data as { id: string }).id };
}

/**
 * Delete pack by id. If FK violation (e.g. pack_openings), archive instead (set is_archive true).
 */
export async function deleteAdminPack(
  packId: string
): Promise<{ deleted: boolean; archived?: boolean; message: string }> {
  const admin = getSupabaseAdmin();

  const { error: deleteError } = await admin.from('packs').delete().eq('id', packId);

  if (!deleteError) {
    return { deleted: true, message: 'Pack deleted successfully' };
  }

  const isFkViolation =
    deleteError.code === '23503' ||
    (typeof deleteError.message === 'string' &&
      deleteError.message.includes('pack_openings_pack_id_fkey'));

  if (isFkViolation) {
    const { error: updateError } = await admin
      .from('packs')
      .update({ is_archive: true })
      .eq('id', packId);

    if (updateError) {
      console.error('Error archiving pack:', updateError);
      throw new Error(updateError.message);
    }
    return { deleted: false, archived: true, message: 'Pack archived (has openings)' };
  }

  throw new Error(deleteError.message);
}

/**
 * Toggle pack is_active (activate/deactivate).
 */
export async function togglePackActive(packId: string): Promise<{ is_active: boolean }> {
  const admin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await admin
    .from('packs')
    .select('is_active')
    .eq('id', packId)
    .single();

  if (fetchError || !current) {
    throw new Error('Pack not found');
  }

  const nextActive = !(current as { is_active: boolean }).is_active;
  const { error: updateError } = await admin
    .from('packs')
    .update({ is_active: nextActive })
    .eq('id', packId);

  if (updateError) {
    console.error('Error toggling pack active:', updateError);
    throw new Error(updateError.message);
  }
  return { is_active: nextActive };
}

/**
 * Get pack by id for admin (is_archive = false), with pack_cards and card data from game table.
 */
export async function getAdminPackById(packId: string): Promise<AdminPackDetail | null> {
  const admin = getSupabaseAdmin();

  const { data: packRow, error: packError } = await admin
    .from('packs')
    .select('*')
    .eq('id', packId)
    .eq('is_archive', false)
    .single();

  if (packError || !packRow) return null;

  const pack = packRow as AdminPackRow & Record<string, unknown>;

  const { data: packCardsRows, error: cardsError } = await admin
    .from('pack_cards')
    .select('*')
    .eq('pack_id', packId);

  if (cardsError) {
    console.error('Error fetching pack cards:', cardsError);
    return { pack: pack as AdminPackRow, packCards: [] };
  }

  const packCards = (packCardsRows ?? []) as Array<AdminPackCardRow & Record<string, unknown>>;
  const gameCode = (pack.game_code as string) ?? '';

  const cardDataMap = new Map<
    string,
    { id: string; name: string | null; image_uri: unknown; prices: unknown; set_code: string | null; set_name: string | null; rarity: string | null }
  >();

  if (packCards.length > 0 && gameCode) {
    const cardsByTable = new Map<string, string[]>();
    for (const pc of packCards) {
      const table = (pc.card_table as string) || `${gameCode}_cards`;
      if (!cardsByTable.has(table)) cardsByTable.set(table, []);
      cardsByTable.get(table)!.push(pc.card_uuid as string);
    }

    for (const [table, cardUuids] of cardsByTable) {
      if (cardUuids.length === 0) continue;
      const { data: cardsData } = await admin
        .from(table)
        .select('id, name, image_uri, prices, set_code, set_name, rarity')
        .in('id', cardUuids);

      if (cardsData) {
        for (const card of cardsData as Array<{
          id: string;
          name: string | null;
          image_uri: unknown;
          prices: unknown;
          set_code: string | null;
          set_name: string | null;
          rarity: string | null;
        }>) {
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
      }
    }
  }

  const packCardsWithData: AdminPackCardWithData[] = packCards.map((pc) => {
    const cardData = cardDataMap.get(pc.card_uuid as string) ?? null;
    return {
      card_uuid: pc.card_uuid as string,
      market_value: (pc.market_value as number) ?? 0,
      is_foil: (pc.is_foil as boolean | null) ?? null,
      condition: (pc.condition as string | null) ?? null,
      card_table: (pc.card_table as string | null) ?? null,
      game_code: (pc.game_code as string | null) ?? null,
      cardData: cardData
        ? {
            id: cardData.id,
            name: cardData.name,
            image_uri: cardData.image_uri,
            prices: cardData.prices,
            set_code: cardData.set_code,
            set_name: cardData.set_name,
            rarity: cardData.rarity,
          }
        : null,
    };
  });

  return {
    pack: pack as AdminPackRow,
    packCards: packCardsWithData,
  };
}

export interface SavePackBody {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  game_code: string;
  rip_cost: number;
  pack_cards?: Array<{
    card_uuid: string;
    market_value: number;
    is_foil: boolean;
    condition?: string;
  }>;
}

/**
 * Save pack: update pack fields and replace pack_cards. Does not change is_active.
 */
export async function saveAdminPack(packId: string, body: SavePackBody): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: packError } = await admin
    .from('packs')
    .update({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      game_code: body.game_code,
      rip_cost: body.rip_cost,
    })
    .eq('id', packId);

  if (packError) {
    console.error('Error updating pack:', packError);
    throw new Error(packError.message);
  }

  await admin.from('pack_cards').delete().eq('pack_id', packId);

  const packCards = body.pack_cards ?? [];
  if (packCards.length > 0) {
    const cardTable = `${body.game_code}_cards`;
    const { error: cardsError } = await admin.from('pack_cards').insert(
      packCards.map((pc) => ({
        pack_id: packId,
        game_code: body.game_code,
        card_table: cardTable,
        card_uuid: pc.card_uuid,
        market_value: pc.market_value,
        is_foil: pc.is_foil,
        condition: pc.condition ?? null,
      }))
    );

    if (cardsError) {
      console.error('Error updating pack cards:', cardsError);
      throw new Error(cardsError.message);
    }
  }
}

/**
 * Publish pack: same as save but sets is_active = true.
 */
export async function publishAdminPack(packId: string, body: SavePackBody): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: packError } = await admin
    .from('packs')
    .update({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      game_code: body.game_code,
      rip_cost: body.rip_cost,
      is_active: true,
    })
    .eq('id', packId);

  if (packError) {
    console.error('Error publishing pack:', packError);
    throw new Error(packError.message);
  }

  await admin.from('pack_cards').delete().eq('pack_id', packId);

  const packCards = body.pack_cards ?? [];
  if (packCards.length > 0) {
    const cardTable = `${body.game_code}_cards`;
    const { error: cardsError } = await admin.from('pack_cards').insert(
      packCards.map((pc) => ({
        pack_id: packId,
        game_code: body.game_code,
        card_table: cardTable,
        card_uuid: pc.card_uuid,
        market_value: pc.market_value,
        is_foil: pc.is_foil,
        condition: pc.condition ?? null,
      }))
    );

    if (cardsError) {
      console.error('Error updating pack cards on publish:', cardsError);
      throw new Error(cardsError.message);
    }
  }
}

/**
 * Unpublish pack: set is_active = false.
 */
export async function unpublishAdminPack(packId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.from('packs').update({ is_active: false }).eq('id', packId);

  if (error) {
    console.error('Error unpublishing pack:', error);
    throw new Error(error.message);
  }
}
