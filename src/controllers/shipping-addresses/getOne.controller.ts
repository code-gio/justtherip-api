import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function getAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const addressId = req.params.id;
    const admin = getSupabaseAdmin();
    const { data: address, error } = await admin
      .from('shipping_addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();
    if (error || !address) {
      res.status(404).json({ error: 'Shipping address not found' });
      return;
    }
    res.status(200).json({ address });
  } catch (err) {
    next(err);
  }
}
