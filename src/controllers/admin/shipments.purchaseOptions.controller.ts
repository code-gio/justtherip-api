import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function getPurchaseOptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameCode = req.query.game_code as string;
    const cardName = req.query.card_name as string | undefined;
    console.log(gameCode, cardName);
    console.log(req.query);
    if (!gameCode) {
      res.status(400).json({ error: 'game_code is required' });
      return;
    }
    const tableName = `tcg_${gameCode}_products`;
    console.log(tableName);
    const admin = getSupabaseAdmin();
    console.log(admin);
    let query = admin.from(tableName).select('*').limit(50);
    if (cardName) query = query.ilike('name', `%${cardName}%`);
    const { data, error } = await query;
    console.log(data);
    if (error) {
      console.log(error);
      res.status(500).json({ error: 'Failed to fetch purchase options' });
      return;
    }
    res.status(200).json({ purchaseOptions: data ?? [], total: (data ?? []).length });
  } catch (err) {
    console.log(err);
    next(err);
  }
}
