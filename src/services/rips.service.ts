import { getSupabaseAdmin } from '../lib/supabase.js';

/** Admin Supabase client (lazy). Use getSupabaseAdmin() for direct DB access. */
export function adminClient() {
  return getSupabaseAdmin();
}

/**
 * Get user's current Rip balance. Returns null on error.
 */
export async function getUserRipBalance(
  userId: string
): Promise<number | null> {
  const { data, error } = await adminClient().rpc("get_user_rip_balance", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error getting Rip balance:", error);
    return null;
  }

  return data;
}

export interface SpendRipsOptions {
  pack_id?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface SpendRipsResult {
  success: boolean;
  balance?: number;
  error?: string;
}

/**
 * Deduct Rips from user balance and record transaction.
 */
export async function spendRips(
  userId: string,
  amount: number,
  options: SpendRipsOptions = {}
): Promise<SpendRipsResult> {
  const admin = getSupabaseAdmin();
  const current = await getUserRipBalance(userId);
  if (current === null) return { success: false, error: 'Failed to fetch balance' };
  if (current < amount) return { success: false, error: 'Insufficient Rips' };

  const newBalance = current - amount;

  const { error: updateError } = await admin
    .from('profiles')
    .update({ rip_balance: newBalance })
    .eq('id', userId);

  if (updateError) {
    console.error('spendRips update error:', updateError);
    return { success: false, error: 'Failed to update balance' };
  }

  await admin.from('rip_transactions').insert({
    user_id: userId,
    amount: -amount,
    balance_after: newBalance,
    reason: options.reason ?? 'spend',
    metadata: options,
  });

  return { success: true, balance: newBalance };
}

export interface AddRipsOptions {
  stripe_payment_intent_id?: string;
  bundle_id?: string;
  amount_cents?: number;
  [key: string]: unknown;
}

export interface AddRipsResult {
  success: boolean;
  balance?: number;
  error?: string;
}

/**
 * Add Rips to user balance and record transaction.
 */
export async function addRips(
  userId: string,
  amount: number,
  options: AddRipsOptions = {}
): Promise<AddRipsResult> {
  const admin = getSupabaseAdmin();
  const current = await getUserRipBalance(userId);
  if (current === null) return { success: false, error: 'Failed to fetch balance' };

  const newBalance = current + amount;

  const { error: updateError } = await admin
    .from('profiles')
    .update({ rip_balance: newBalance })
    .eq('id', userId);

  if (updateError) {
    console.error('addRips update error:', updateError);
    return { success: false, error: 'Failed to update balance' };
  }

  await admin.from('rip_transactions').insert({
    user_id: userId,
    amount,
    balance_after: newBalance,
    reason: 'purchase',
    metadata: options,
  });

  return { success: true, balance: newBalance };
}

export interface RipBundle {
  id: string;
  name: string;
  rips: number;
  price_cents: number;
  is_active: boolean;
  [key: string]: unknown;
}

/**
 * Get all active Rip bundles.
 */
export async function getRipBundles(): Promise<RipBundle[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('rip_bundles')
    .select('*')
    .eq('is_active', true)
    .order('price_cents');

  if (error) {
    console.error('getRipBundles error:', error);
    return [];
  }
  return (data as RipBundle[]) ?? [];
}

/**
 * Get a single Rip bundle by id.
 */
export async function getRipBundle(id: string): Promise<RipBundle | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('rip_bundles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as RipBundle;
}

export interface RecordStripePaymentParams {
  userId: string;
  stripePaymentIntentId: string;
  stripeCheckoutSessionId: string;
  bundleId: string;
  amountCents: number;
  ripsPurchased: number;
  status: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a Stripe payment (e.g. pending on checkout.session.completed).
 */
export async function recordStripePayment(params: RecordStripePaymentParams): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('stripe_payments').insert({
    user_id: params.userId,
    stripe_payment_intent_id: params.stripePaymentIntentId,
    stripe_checkout_session_id: params.stripeCheckoutSessionId,
    bundle_id: params.bundleId,
    amount_cents: params.amountCents,
    rips_purchased: params.ripsPurchased,
    status: params.status,
    metadata: params.metadata ?? {},
  });
}

/**
 * Update Stripe payment status by payment intent id.
 */
export async function updateStripePaymentStatus(
  paymentIntentId: string,
  status: string
): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from('stripe_payments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntentId);
}
