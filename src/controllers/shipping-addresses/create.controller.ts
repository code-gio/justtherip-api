import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function createAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
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
    const { name, phone, address_line1, address_line2, city, state, postal_code, country = 'US', is_default = false, label } = body;
    if (!name || !address_line1 || !city || !state || !postal_code) {
      res.status(400).json({ error: 'Missing required fields: name, address_line1, city, state, postal_code' });
      return;
    }
    const admin = getSupabaseAdmin();
    if (is_default) {
      await admin.from('shipping_addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
    }
    const { data: address, error } = await admin
      .from('shipping_addresses')
      .insert({
        user_id: userId,
        name,
        phone: phone ?? null,
        address_line1,
        address_line2: address_line2 ?? null,
        city,
        state,
        postal_code,
        country,
        is_default,
        label: label ?? null,
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: 'Failed to create shipping address' });
      return;
    }
    res.status(200).json({ success: true, address });
  } catch (err) {
    next(err);
  }
}
