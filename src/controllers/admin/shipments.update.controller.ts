import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function updateAdminShipment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const shipmentId = req.params.id;
    const body = req.body as {
      status?: string;
      carrier?: string;
      tracking_number?: string;
      estimated_delivery_date?: string;
      delivered_date?: string;
      admin_notes?: string;
    };
    const { status, carrier, tracking_number, estimated_delivery_date, delivered_date, admin_notes } = body;

    const admin = getSupabaseAdmin();
    const { data: existing, error: fetchError } = await admin.from('shipments').select('*').eq('id', shipmentId).single();
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }
    const existingShipment = existing as Record<string, unknown>;
    const newStatus = status ?? existingShipment.status;
    if ((newStatus === 'shipped' || newStatus === 'delivered') && (!carrier || !tracking_number)) {
      if (status && status !== existingShipment.status) {
        res.status(400).json({ error: 'Carrier and tracking number are required for shipped/delivered status' });
        return;
      }
      if (!existingShipment.carrier || !existingShipment.tracking_number) {
        res.status(400).json({ error: 'Carrier and tracking number are required for shipped/delivered status' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'processing' && existingShipment.status !== 'processing') updateData.processed_at = new Date().toISOString();
      if (status === 'shipped' && existingShipment.status !== 'shipped') updateData.shipped_at = new Date().toISOString();
    }
    if (carrier !== undefined) updateData.carrier = carrier ?? null;
    if (tracking_number !== undefined) updateData.tracking_number = tracking_number ?? null;
    if (estimated_delivery_date !== undefined) updateData.estimated_delivery_date = estimated_delivery_date ?? null;
    if (delivered_date !== undefined) updateData.delivered_date = delivered_date ?? null;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes ?? null;

    const { data: updated, error: updateError } = await admin.from('shipments').update(updateData).eq('id', shipmentId).select('*').single();
    if (updateError) {
      res.status(500).json({ error: 'Failed to update shipment' });
      return;
    }
    const u = updated as Record<string, unknown>;
    const { data: profile } = await admin.from('profiles').select('id, email, username, display_name').eq('id', u.user_id).single();
    const p = profile as { email?: string; display_name?: string; username?: string } | null;
    res.status(200).json({
      success: true,
      shipment: {
        id: u.id,
        userId: u.user_id,
        userEmail: p?.email,
        userName: p?.display_name ?? p?.username,
        cardName: u.card_name,
        cardTier: u.card_tier_name,
        cardTierName: u.card_tier_name,
        cardValue: `$${((u.card_value_cents as number) / 100).toFixed(2)}`,
        cardImage: u.card_image_url,
        status: u.status,
        requestDate: u.requested_at ? new Date(u.requested_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        requestedAt: u.requested_at,
        trackingNumber: u.tracking_number,
        carrier: u.carrier,
        estimatedDelivery: u.estimated_delivery_date ? new Date(u.estimated_delivery_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        deliveredDate: u.delivered_date ? new Date(u.delivered_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        shippingAddress: u.shipping_address_full,
        shippingName: u.shipping_name,
        shippingPhone: u.shipping_phone,
        adminNotes: u.admin_notes,
        processedAt: u.processed_at,
        shippedAt: u.shipped_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}
