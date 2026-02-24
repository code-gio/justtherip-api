import type { Request, Response, NextFunction } from 'express';
import type Stripe from 'stripe';
import { config } from '../../config/configuration.js';
import { verifyWebhookSignature } from '../../services/stripe.service.js';
import {
  addRips,
  recordStripePayment,
  updateStripePaymentStatus,
} from '../../services/rips.service.js';

export async function stripeWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawBody = req.body;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).send('No signature');
    return;
  }
  const secret = config.stripe.webhookSecret;
  if (!secret) {
    res.status(500).send('Webhook secret not configured');
    return;
  }
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(body, signature, secret);
  } catch (err) {
    res.status(400).send('Invalid signature');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(pi);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const bundleId = session.metadata?.bundle_id;
  const rips = parseInt(session.metadata?.rips ?? '0', 10);
  if (!userId || !bundleId || !rips) return;
  await recordStripePayment({
    userId,
    stripePaymentIntentId: session.payment_intent as string,
    stripeCheckoutSessionId: session.id,
    bundleId,
    amountCents: session.amount_total ?? 0,
    ripsPurchased: rips,
    status: 'pending',
    metadata: { customer_email: session.customer_email, customer_details: session.customer_details },
  });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const userId = paymentIntent.metadata?.user_id;
  const bundleId = paymentIntent.metadata?.bundle_id;
  const rips = parseInt(paymentIntent.metadata?.rips ?? '0', 10);
  if (!userId || !bundleId || !rips) return;
  await addRips(userId, rips, {
    stripe_payment_intent_id: paymentIntent.id,
    bundle_id: bundleId,
    amount_cents: paymentIntent.amount,
  });
  await updateStripePaymentStatus(paymentIntent.id, 'succeeded');
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  await updateStripePaymentStatus(paymentIntent.id, 'failed');
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = charge.payment_intent as string;
  if (!paymentIntentId) return;
  await updateStripePaymentStatus(paymentIntentId, 'refunded');
}
