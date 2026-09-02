import { NextResponse } from 'next/server';
import { getStripe, resolveOrigin } from '../../../lib/stripe';
import { PLANS, priceIdFor, isPlaceholderPriceId } from '../../../lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const planId = body?.plan;
  const plan = PLANS[planId];
  if (!plan) {
    return NextResponse.json({ error: 'Unknown package selected.' }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          'Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment (see README).',
      },
      { status: 503 }
    );
  }

  const price = priceIdFor(planId);
  if (isPlaceholderPriceId(price)) {
    return NextResponse.json(
      {
        error:
          'Stripe price IDs are still placeholders. Set STRIPE_PRICE_BASIC and STRIPE_PRICE_PREMIUM (see README).',
      },
      { status: 503 }
    );
  }

  const origin = resolveOrigin(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url: `${origin}/cancel?plan=${planId}`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      metadata: { plan: planId, product: 'mindscale-echo' },
      payment_intent_data: {
        metadata: { plan: planId, product: 'mindscale-echo' },
        description: `Mindscale Echo — ${plan.name} release`,
      },
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[checkout] Stripe session failed:', err?.message);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again or contact support.' },
      { status: 502 }
    );
  }
}
