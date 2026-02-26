import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { addRips } from '../../services/rips.service.js';
import { calculateSellbackValue } from '../../services/card-draw.service.js';

export async function sellCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { card_id: cardId } = req.body as { card_id?: string };
    if (!cardId) {
      res.status(400).json({ error: 'card_id is required' });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: card, error: fetchError } = await admin
      .from('user_inventory')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', userId)
      .eq('is_sold', false)
      .eq('is_shipped', false)
      .single();

    if (fetchError || !card) {
      const { data: existing } = await admin
        .from('user_inventory')
        .select('is_sold, is_shipped, shipment_id')
        .eq('id', cardId)
        .eq('user_id', userId)
        .single();
      if (existing) {
        if ((existing as { is_sold?: boolean }).is_sold) {
          res.status(400).json({ error: 'Card has already been sold' });
          return;
        }
        if ((existing as { is_shipped?: boolean }).is_shipped || (existing as { shipment_id?: string }).shipment_id) {
          res.status(400).json({ error: 'Card has already been shipped and cannot be sold' });
          return;
        }
      }
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    const c = card as { card_value_cents?: number; id: string };
    const sellbackRips = await calculateSellbackValue(c.card_value_cents ?? 0);
    const addResult = await addRips(userId, sellbackRips, {
      card_id: c.id,
      card_value_cents: c.card_value_cents,
      reason: 'card_sellback',
    });
    if (!addResult.success) {
      res.status(500).json({ error: 'Failed to credit Rips' });
      return;
    }
    await admin
      .from('user_inventory')
      .update({
        is_sold: true,
        sold_at: new Date().toISOString(),
        sellback_rips: sellbackRips,
      })
      .eq('id', cardId);

    res.status(200).json({
      success: true,
      card: {
        id: c.id,
        value_cents: c.card_value_cents,
        value_usd: ((c.card_value_cents ?? 0) / 100).toFixed(2),
      },
      rips_credited: sellbackRips,
      new_balance: addResult.balance,
    });
  } catch (err) {
    next(err);
  }
}
