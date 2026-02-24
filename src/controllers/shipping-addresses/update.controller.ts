import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function updateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const addressId = req.params.id;
    const body = req.body as {
      name?: string;
      phone?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
      is_default?: boolean;
      label?: string;
    };

    const admin = getSupabaseAdmin();
    const { data: existing, error: fetchError } = await admin
      .from('shipping_addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Shipping address not found' });
      return;
    }
    const existingAddress = existing as Record<string, unknown>;
    if (body.is_default && !existingAddress.is_default) {
      await admin.from('shipping_addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true).neq('id', addressId);
    }
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone ?? null;
    if (body.address_line1 !== undefined) updateData.address_line1 = body.address_line1;
    if (body.address_line2 !== undefined) updateData.address_line2 = body.address_line2 ?? null;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.postal_code !== undefined) updateData.postal_code = body.postal_code;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;
    if (body.label !== undefined) updateData.label = body.label ?? null;

    const { data: address, error } = await admin
      .from('shipping_addresses')
      .update(updateData)
      .eq('id', addressId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: 'Failed to update shipping address' });
      return;
    }
    res.status(200).json({ success: true, address });
  } catch (err) {
    next(err);
  }
}
