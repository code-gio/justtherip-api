import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { calculatePackCardProbabilities } from '../../services/card-draw.service.js';

function extractCardImageUrl(imageUri: unknown): string | null {
  if (!imageUri) return null;
  if (typeof imageUri === 'string') {
    try {
      const parsed = JSON.parse(imageUri) as Record<string, string>;
      return parsed?.normal ?? parsed?.large ?? parsed?.png ?? parsed?.small ?? imageUri;
    } catch {
      return imageUri;
    }
  }
  if (typeof imageUri === 'object' && imageUri) {
    const o = imageUri as Record<string, string>;
    return o.normal ?? o.large ?? o.png ?? o.small ?? null;
  }
  return null;
}

export async function getSimulatorPack(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const packId = req.params.packId;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: pack, error: packError } = await admin.from('packs').select('id, game_code, is_active').eq('id', packId).single();
    if (packError || !pack) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    if (!(pack as { is_active?: boolean }).is_active) {
      res.status(400).json({ error: 'Pack is not active' });
      return;
    }
    const gameCode = (pack as { game_code?: string }).game_code ?? 'mtg';
    const { data: packCards, error: packCardsError } = await admin
      .from('pack_cards')
      .select('card_uuid, market_value, is_foil, condition')
      .eq('pack_id', packId);
    if (packCardsError) {
      res.status(500).json({ error: 'Failed to fetch pack cards' });
      return;
    }
    const cardTable = `${gameCode}_cards`;
    const cardUuids = (packCards ?? []).map((c: { card_uuid: string }) => c.card_uuid);
    let cardMetadata: Record<string, unknown>[] = [];
    if (cardUuids.length > 0) {
      const { data: cardData } = await admin.from(cardTable).select('id, name, image_uri, rarity, set_name, set_code').in('id', cardUuids);
      cardMetadata = (cardData as Record<string, unknown>[]) ?? [];
    }
    const probabilityData = await calculatePackCardProbabilities(packId);
    const probabilityMap = new Map<string, number>();
    probabilityData.forEach((e: { card_uuid?: string; probability?: number }) => {
      if (e.card_uuid != null) probabilityMap.set(e.card_uuid, e.probability ?? 0);
    });
    const metadataMap = new Map<string, Record<string, unknown>>();
    cardMetadata.forEach((c) => metadataMap.set((c.id as string) ?? '', c));
    const cards = (packCards ?? []).map((packCard: { card_uuid: string; market_value?: number; is_foil?: boolean; condition?: string }) => {
      const meta = metadataMap.get(packCard.card_uuid) ?? {};
      return {
        id: packCard.card_uuid,
        name: meta.name ?? 'Unknown Card',
        image_url: extractCardImageUrl(meta.image_uri),
        market_value: packCard.market_value ?? 0,
        probability: probabilityMap.get(packCard.card_uuid) ?? 0,
        rarity: meta.rarity ?? null,
        set_name: meta.set_name ?? null,
        set_code: meta.set_code ?? null,
        is_foil: packCard.is_foil ?? false,
        condition: packCard.condition ?? null,
      };
    });
    res.status(200).json({ cards });
  } catch (err) {
    next(err);
  }
}
