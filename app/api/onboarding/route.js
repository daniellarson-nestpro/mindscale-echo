import { NextResponse } from 'next/server';
import { getSession, normalizeEmail } from '../../../lib/auth';
import { getStripe } from '../../../lib/stripe';
import { attachBrief } from '../../../lib/orders';
import { saveLeadFromPayload, upsertLead } from '../../../lib/leads';
import { isDatabaseConfigured } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED = ['companyName', 'contactName', 'contactEmail', 'announcementType'];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

async function actorEmailFromRequest(sessionId) {
  const session = getSession();
  if (session?.email) return session.email;

  if (!sessionId) return null;
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const email = normalizeEmail(checkout.customer_details?.email || checkout.customer_email);
    if (checkout.payment_status === 'paid' && email) return email;
  } catch (err) {
    console.error('[onboarding] could not retrieve checkout session:', err?.message);
  }
  return null;
}

/**
 * Receives the post-checkout onboarding brief, stores it on the paid order,
 * and optionally POSTs to ONBOARDING_WEBHOOK_URL if that variable is set.
 */
export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the submitted form.' }, { status: 400 });
  }

  const value = (key) => {
    const raw = form.get(key);
    return typeof raw === 'string' ? raw.trim() : '';
  };

  const payload = {
    sessionId: value('sessionId'),
    orderId: value('orderId'),
    plan: value('plan'),
    companyName: value('companyName'),
    website: value('website'),
    contactName: value('contactName'),
    contactEmail: value('contactEmail'),
    articleUrl: value('articleUrl'),
    announcementType: value('announcementType'),
    quote: value('quote'),
    quoteAttribution: value('quoteAttribution'),
    notes: value('notes'),
    submittedAt: new Date().toISOString(),
  };

  const missing = REQUIRED.filter((key) => !payload[key]);
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required field(s): ${missing.join(', ')}.` },
      { status: 400 }
    );
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.contactEmail)) {
    return NextResponse.json({ error: 'Please provide a valid contact email.' }, { status: 400 });
  }

  const actorEmail = await actorEmailFromRequest(payload.sessionId);
  if (!actorEmail) {
    return NextResponse.json(
      { error: 'Please log in or return from checkout before submitting a brief.' },
      { status: 401 }
    );
  }

  const logo = form.get('logo');
  let logoMeta = null;
  if (logo && typeof logo === 'object' && 'size' in logo && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'Logo must be 5 MB or smaller.' }, { status: 400 });
    }
    logoMeta = { name: logo.name, type: logo.type, size: logo.size };
    // HOOK (storage): upload `await logo.arrayBuffer()` to S3 / R2 / Supabase
    // Storage or UploadThing, then persist the resulting URL alongside the order.
  }

  const saved = await attachBrief({
    actorEmail,
    orderId: payload.orderId,
    sessionId: payload.sessionId,
    brief: payload,
    logoMeta,
  });

  if (saved.error === 'database') {
    return NextResponse.json(
      { error: 'Could not save the brief just now. Please try again shortly.' },
      { status: 503 }
    );
  }
  if (saved.error === 'not_found') {
    return NextResponse.json(
      { error: 'We could not find a paid release for this checkout. Try logging in with your receipt email.' },
      { status: 404 }
    );
  }
  if (saved.error === 'already_submitted') {
    return NextResponse.json(
      {
        error:
          'This release already has a brief. Email hello@mindscalepartners.com if you need to change it.',
      },
      { status: 409 }
    );
  }
  if (saved.error) {
    return NextResponse.json({ error: 'Could not save the brief.' }, { status: 400 });
  }

  const webhook = process.env.ONBOARDING_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          orderId: saved.order?.id || payload.orderId,
          logo: logoMeta,
        }),
      });
    } catch (err) {
      console.error('[onboarding] webhook delivery failed:', err?.message);
      // Non-fatal: the brief is already stored on the order.
    }
  }

  try {
    await upsertLead(actorEmail, {
      contactName: payload.contactName,
      companyName: payload.companyName,
      website: payload.website,
      announcementType: payload.announcementType,
      articleUrl: payload.articleUrl,
      quote: payload.quote,
      quoteAttribution: payload.quoteAttribution,
      notes: payload.notes,
      furthestStep: 'account',
    });
  } catch (err) {
    console.error('[onboarding] lead sync failed:', err?.message);
  }

  console.log('[onboarding] brief received', {
    orderId: saved.order?.id,
    sessionId: payload.sessionId,
    plan: payload.plan,
    contactEmail: payload.contactEmail,
    logo: logoMeta,
  });

  return NextResponse.json({ ok: true, orderId: saved.order?.id });
}

/**
 * Authenticated autosave onto the lead (unpurchased briefs).
 * Same camelCase field names as POST. articleFile is ignored here —
 * HOOK (storage): persist article binary via R2/S3 in a later PR.
 */
export async function PATCH(request) {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const payload = body && typeof body === 'object' ? body : {};
  // articleFile / logo binary intentionally discarded in this slice.
  const saved = await saveLeadFromPayload(session.email, payload);

  if (saved.error === 'database') {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
