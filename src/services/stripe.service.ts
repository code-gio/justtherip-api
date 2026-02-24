import Stripe from 'stripe';
import { config } from '../config/configuration.js';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export interface CreateCheckoutSessionParams {
  bundleId: string;
  bundleName: string;
  rips: number;
  priceCents: number;
  userId: string;
  userEmail: string;
  customerId?: string;
}

/**
 * Create a Stripe Checkout Session for Rip bundle purchase.
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ id: string; url: string | null }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: params.bundleName,
            description: `${params.rips} Rips`,
          },
          unit_amount: params.priceCents,
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerId ? undefined : params.userEmail,
    customer: params.customerId ?? undefined,
    metadata: {
      user_id: params.userId,
      bundle_id: params.bundleId,
      rips: String(params.rips),
    },
    success_url: `${config.nodeEnv === 'production' ? 'https://justtherip.com' : 'http://localhost:5173'}/rips?success=true`,
    cancel_url: `${config.nodeEnv === 'production' ? 'https://justtherip.com' : 'http://localhost:5173'}/rips?canceled=true`,
  });
  return { id: session.id, url: session.url };
}

/**
 * Verify Stripe webhook signature and return parsed event.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(body, signature, secret) as Stripe.Event;
}
