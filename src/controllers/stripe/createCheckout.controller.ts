import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createCheckoutSession } from '../../services/stripe.service.js';
import { getRipBundle } from '../../services/rips.service.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const checkoutSchema = z.object({
  bundle_id: z.string().uuid('Invalid bundle ID'),
});

export async function createCheckout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
      return;
    }
    const { bundle_id } = parsed.data;
    const bundle = await getRipBundle(bundle_id);
    if (!bundle || !bundle.is_active) {
      res.status(404).json({ error: 'Bundle not found or inactive' });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    const session = await createCheckoutSession({
      bundleId: bundle.id,
      bundleName: bundle.name,
      rips: bundle.rips,
      priceCents: bundle.price_cents,
      userId,
      userEmail: req.user!.email ?? '',
      customerId: customerId ?? undefined,
    });
    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    next(err);
  }
}
