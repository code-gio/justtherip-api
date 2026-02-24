import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../../lib/supabase.js';

export async function getSystemConfig(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.query.key as string;
    if (!key) {
      res.status(400).json({ error: 'key parameter is required' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('system_config').select('value').eq('key', key).single();
    if (error || !data) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }
    res.status(200).json({ value: (data as { value: unknown }).value });
  } catch (err) {
    next(err);
  }
}

export async function updateSystemConfig(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { key, value } = req.body as { key?: string; value?: unknown };
    if (!key) {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    if (value === undefined) {
      res.status(400).json({ error: 'value is required' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from('system_config').select('key').eq('key', key).single();
    if (existing) {
      const { error } = await admin.from('system_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) {
        res.status(500).json({ error: 'Failed to update system config' });
        return;
      }
    } else {
      const { error } = await admin.from('system_config').insert({ key, value });
      if (error) {
        res.status(500).json({ error: 'Failed to create system config' });
        return;
      }
    }
    res.status(200).json({ success: true, key, value });
  } catch (err) {
    next(err);
  }
}
