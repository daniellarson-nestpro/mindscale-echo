import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — per-section brief autosave. To be folded into the existing
 * POST /api/onboarding rather than living as a separate store.
 *
 * PATCH receives partial field maps on blur and on a 2s idle debounce.
 * Partial records are the normal case, not an error. Locked field names:
 * companyName, website, contactName, contactEmail, phone, articleUrl,
 * announcementType, quote, quoteAttribution, notes (+ articleFile, articleText,
 * logo as uploads).
 *
 * Requires a lead row so a brief can exist before any Stripe session.
 */
export async function PATCH(request) {
  let patch = {};
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  console.log('[brief PATCH STUB]', Object.keys(patch));
  return NextResponse.json({ saved: true, at: new Date().toISOString() });
}

export async function GET() {
  // HOOK: return the saved brief so /brief can resume mid-form.
  return NextResponse.json({ brief: null });
}
