import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function deleteAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const addressId = req.params.id;
    const admin = getSupabaseAdmin();
    const { data: existing, error: fetchError } = await admin
      .from('shipping_addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();
    if (fetchError || !existing) {
      res.status(404).json({ error: 'Shipping address not found' });
      return;
    }
    const { error } = await admin.from('shipping_addresses').delete().eq('id', addressId).eq('user_id', userId);
    if (error) {
      res.status(500).json({ error: 'Failed to delete shipping address' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
