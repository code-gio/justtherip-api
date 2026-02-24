import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getUserRipBalance, spendRips } from '../../services/rips.service.js';
import { drawCardFromPack } from '../../services/card-draw.service.js';

export async function openPack(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { pack_id: packId } = req.body as { pack_id?: string };
    if (!packId) {
      res.status(400).json({ error: 'pack_id is required' });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: pack, error: packFetchError } = await admin
      .from('packs')
      .select('id, rip_cost, game_code, is_active')
      .eq('id', packId)
      .single();

    if (packFetchError || !pack) {
      res.status(404).json({ error: 'Pack not found' });
      return;
    }
    const p = pack as { is_active?: boolean; rip_cost?: number; game_code?: string };
    if (!p.is_active) {
      res.status(400).json({ error: 'Pack is not active' });
      return;
    }
    const packCostRips = p.rip_cost ?? 0;
    const gameCode = p.game_code ?? 'mtg';

    const currentBalance = await getUserRipBalance(userId);
    if (currentBalance === null) {
      res.status(500).json({ error: 'Failed to fetch balance' });
      return;
    }
    if (currentBalance < packCostRips) {
      res.status(400).json({
        error: 'Insufficient Rips',
        balance: currentBalance,
        required: packCostRips,
      });
      return;
    }

    const spendResult = await spendRips(userId, packCostRips, {
      pack_id: packId,
      reason: 'pack_opening',
    });
    if (!spendResult.success) {
      res.status(500).json({ error: spendResult.error ?? 'Failed to spend Rips' });
      return;
    }

    const drawResult = await drawCardFromPack(packId, userId);
    if (!drawResult.success || !drawResult.card) {
      res.status(500).json({ error: drawResult.error ?? 'Failed to draw card' });
      return;
    }
    const card = drawResult.card;
    const valueCents = Math.round(card.value_cents);
    const cardName = card.card_name ?? 'Unknown Card';
    const cardData = {
      card_uuid: card.card_uuid,
      value_cents: valueCents,
      card_name: cardName,
      card_image_url: card.card_image_url ?? null,
      set_name: card.set_name ?? null,
      set_code: card.set_code ?? null,
      rarity: card.rarity ?? null,
    };

    const { data: packOpening } = await admin
      .from('pack_openings')
      .insert({
        user_id: userId,
        pack_id: packId,
        rips_spent: packCostRips,
        cards_pulled: [cardData],
        total_value_cents: valueCents,
      })
      .select()
      .single();

    const { data: inventoryItem, error: inventoryError } = await admin
      .from('user_inventory')
      .insert({
        user_id: userId,
        pack_opening_id: (packOpening as { id?: string })?.id,
        card_uuid: card.card_uuid,
        game_code: gameCode,
        card_name: cardName,
        card_image_url: card.card_image_url ?? null,
        card_value_cents: valueCents,
        set_name: card.set_name ?? null,
        set_code: card.set_code ?? null,
        rarity: card.rarity ?? null,
        is_foil: card.is_foil ?? false,
        condition: card.condition ?? 'NM',
      })
      .select()
      .single();

    if (inventoryError) {
      res.status(500).json({ error: 'Failed to add card to inventory' });
      return;
    }
    const item = inventoryItem as { id: string; card_image_url?: string };
    res.status(200).json({
      success: true,
      card: {
        id: item.id,
        value_cents: valueCents,
        value_usd: (valueCents / 100).toFixed(2),
        card_name: cardName,
        card_image_url: card.card_image_url ?? item.card_image_url ?? null,
        set_name: card.set_name ?? null,
        rarity: card.rarity ?? null,
      },
      new_balance: spendResult.balance,
      pack_opening_id: (packOpening as { id?: string })?.id,
    });
  } catch (err) {
    next(err);
  }
}
