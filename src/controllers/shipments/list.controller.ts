import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function listShipments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const statusFilter = req.query.status as string | undefined;

    const admin = getSupabaseAdmin();
    let query = admin
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data: shipments, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Failed to fetch shipments' });
      return;
    }
    const transformed = (shipments ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      cardName: s.card_name,
      cardValue: `$${((s.card_value_cents as number) / 100).toFixed(2)}`,
      cardImage: s.card_image_url ?? undefined,
      status: s.status,
      requestDate: s.requested_at ? new Date(s.requested_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      trackingNumber: s.tracking_number,
      carrier: s.carrier,
      estimatedDelivery: s.estimated_delivery_date ? new Date(s.estimated_delivery_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      deliveredDate: s.delivered_date ? new Date(s.delivered_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      shippingAddress: s.shipping_address_full,
    }));
    res.status(200).json({ shipments: transformed });
  } catch (err) {
    next(err);
  }
}
