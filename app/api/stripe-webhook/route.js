import { NextResponse } from 'next/server';
import { getStripe } from '../../../lib/stripe';
import { notifyPaidOrder, upsertOrderFromCheckoutSession } from '../../../lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  if (!secret || !stripe) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured (STRIPE_WEBHOOK_SECRET).' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err?.message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  let order = null;
  try {
    const sessionId = event.data?.object?.id;
    const session = sessionId
      ? await stripe.checkout.sessions.retrieve(sessionId)
      : event.data?.object;
    order = await upsertOrderFromCheckoutSession(session);
  } catch (err) {
    console.error('[stripe-webhook] persist failed:', err?.message);
    return NextResponse.json({ error: 'Could not persist order.' }, { status: 500 });
  }

  // Email failures are logged inside notifyPaidOrder and must not 500 the webhook.
  await notifyPaidOrder(order);
  return NextResponse.json({ received: true });
}
