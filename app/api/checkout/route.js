import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { getStripe, resolveOrigin } from '../../../lib/stripe';
import { PLANS, priceIdFor, isPlaceholderPriceId } from '../../../lib/plans';
import { appendCheckoutParams, looksLikeEmail, safePreviewToken, safeRelativePath } from '../../../lib/url';
import { getLeadByEmail } from '../../../lib/leads';

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
  const nextPath = safeRelativePath(body?.next);
  const bodyEmail = looksLikeEmail(body?.email);
  const token = nextPath ? safePreviewToken(body?.token) : null;

  // Resolve email: session takes precedence for V2 funnel
  const session = getSession();
  const sessionEmail = session?.email || '';
  const email = sessionEmail || bodyEmail || '';

  // Resolve lead and compose run IDs for metadata
  let leadId = '';
  let composeRunId = '';
  if (email) {
    try {
      const lead = await getLeadByEmail(email);
      leadId = lead?.id || '';
      composeRunId = lead?.current_compose_run_id || '';
    } catch {
      // Non-fatal: metadata enrichment only
    }
  }

  const successPath = nextPath
    ? appendCheckoutParams(nextPath, { planId, token })
    : `/account?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&paid=1`;
  // V2 funnel: cancels return to account/checkout
  const cancelPath = nextPath
    ? token
      ? `/checkout?token=${encodeURIComponent(token)}`
      : '/account'
    : `/cancel?plan=${planId}`;

  const metadata = nextPath
    ? {
        funnel: 'v2',
        token: token || '',
        email: email || '',
        lead_id: leadId,
        compose_run_id: composeRunId,
        product: 'mindscale-echo',
        plan: planId,
      }
    : {
        funnel: 'v1',
        plan: planId,
        product: 'mindscale-echo',
        email: email || '',
        lead_id: leadId,
      };

  try {
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      ...(email ? { customer_email: email } : {}),
      ...(token ? { client_reference_id: token } : {}),
      metadata,
      payment_intent_data: {
        metadata,
        description: `Mindscale Echo — ${plan.name} release`,
      },
    });

    return NextResponse.json({ url: stripeSession.url, id: stripeSession.id });
  } catch (err) {
    console.error('[checkout] Stripe session failed:', err?.message);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again or contact support.' },
      { status: 502 }
    );
  }
}
