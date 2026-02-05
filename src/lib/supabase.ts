import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/configuration.js';

let adminClient: SupabaseClient | null = null;

/**
 * Returns the Supabase admin (service role) client for server-side operations.
 * Throws if Supabase URL or service role key are not configured.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error(
        'Supabase is not configured: set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }
    adminClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
