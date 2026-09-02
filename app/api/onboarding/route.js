import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED = ['companyName', 'contactName', 'contactEmail', 'announcementType'];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Receives the post-checkout onboarding brief.
 *
 * Persistence is intentionally pluggable — see the HOOK markers below to wire
 * this to email (Resend/Postmark), a CRM, a sheet, or your database.
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

  const logo = form.get('logo');
  let logoMeta = null;
  if (logo && typeof logo === 'object' && 'size' in logo && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'Logo must be 5 MB or smaller.' }, { status: 400 });
    }
    logoMeta = { name: logo.name, type: logo.type, size: logo.size };
    // HOOK (storage): upload `await logo.arrayBuffer()` to S3 / R2 / Supabase
    // Storage and UploadThing, then persist the resulting URL alongside payload.
  }

  // HOOK (delivery): forward the brief to your intake system.
  const webhook = process.env.ONBOARDING_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, logo: logoMeta }),
      });
    } catch (err) {
      console.error('[onboarding] webhook delivery failed:', err?.message);
      // Non-fatal: the customer still gets confirmation, the brief is logged.
    }
  }

  console.log('[onboarding] brief received', { ...payload, logo: logoMeta });

  return NextResponse.json({ ok: true });
}
