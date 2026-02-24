import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

function getCardTier(valueCents: number): string {
  if (valueCents >= 50000) return 'legendary';
  if (valueCents >= 5000) return 'epic';
  if (valueCents >= 500) return 'rare';
  return 'common';
}

export async function shipCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { card_id: cardId, shipping_address_id: addressId } = req.body as {
      card_id?: string;
      shipping_address_id?: string;
    };
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
      res.status(404).json({ error: 'Card not found, already sold, or already shipped' });
      return;
    }
    const c = card as { shipment_id?: string };
    if (c.shipment_id) {
      const { data: existing } = await admin
        .from('shipments')
        .select('id, status')
        .eq('id', c.shipment_id)
        .in('status', ['pending', 'processing', 'shipped'])
        .single();
      if (existing) {
        res.status(400).json({ error: 'Card already has an active shipment' });
        return;
      }
    }

    let shippingAddress: Record<string, unknown> | null = null;
    let shippingAddressFull = '';
    let shippingName = '';
    let shippingPhone: string | null = null;

    if (addressId) {
      const { data: address, error: addressError } = await admin
        .from('shipping_addresses')
        .select('*')
        .eq('id', addressId)
        .eq('user_id', userId)
        .single();
      if (addressError || !address) {
        res.status(404).json({ error: 'Shipping address not found' });
        return;
      }
      shippingAddress = address as Record<string, unknown>;
      shippingName = (address as { name?: string }).name ?? '';
      shippingPhone = (address as { phone?: string }).phone ?? null;
      const a = address as { address_line1?: string; address_line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      shippingAddressFull = [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ');
    } else {
      const { data: defaultAddress } = await admin
        .from('shipping_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();
      if (!defaultAddress) {
        res.status(400).json({ error: 'No shipping address provided. Please add a shipping address first.' });
        return;
      }
      shippingAddress = defaultAddress as Record<string, unknown>;
      shippingName = (defaultAddress as { name?: string }).name ?? '';
      shippingPhone = (defaultAddress as { phone?: string }).phone ?? null;
      const a = defaultAddress as { address_line1?: string; address_line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      shippingAddressFull = [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ');
    }

    const cardTier = getCardTier((card as { card_value_cents?: number }).card_value_cents ?? 0);
    const { data: shipment, error: shipmentError } = await admin
      .from('shipments')
      .insert({
        user_id: userId,
        inventory_card_id: cardId,
        status: 'pending',
        shipping_address_id: (shippingAddress as { id: string }).id,
        shipping_address_full: shippingAddressFull,
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        card_name: (card as { card_name?: string }).card_name,
        card_tier_name: cardTier,
        card_value_cents: (card as { card_value_cents?: number }).card_value_cents,
        card_image_url: (card as { card_image_url?: string }).card_image_url,
      })
      .select()
      .single();

    if (shipmentError) {
      res.status(500).json({ error: 'Failed to create shipment' });
      return;
    }
    await admin
      .from('user_inventory')
      .update({ shipment_id: (shipment as { id: string }).id })
      .eq('id', cardId);

    res.status(200).json({
      success: true,
      shipment: {
        id: (shipment as { id: string }).id,
        status: (shipment as { status?: string }).status,
        card_name: (card as { card_name?: string }).card_name,
        card_value: (((card as { card_value_cents?: number }).card_value_cents ?? 0) / 100).toFixed(2),
      },
    });
  } catch (err) {
    next(err);
  }
}
