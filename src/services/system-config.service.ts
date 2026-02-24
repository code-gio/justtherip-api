import { getSupabaseAdmin } from '../lib/supabase.js';

/**
 * Get a system config value by key (e.g. "sellback_rate").
 * Returns null if not found or on error.
 */
export async function getSystemConfigValue(key: string): Promise<string | number | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('system_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || data == null) return null;
  const v = (data as { value?: unknown }).value;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (v != null && typeof v === 'object') return JSON.stringify(v) as unknown as string;
  return null;
}
