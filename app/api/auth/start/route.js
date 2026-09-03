import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — to be replaced by the backend's extension of the existing V1 magic
 * link (`POST /api/auth/login`). Do not build a second login on top of this.
 *
 * Contract the frontend expects:
 *  - issues a 6-digit code AND a long-secret link for the same attempt
 *  - either redeems, and redeeming one burns both
 *  - 20-minute expiry
 *  - optional `prefill` { contactName, phone } attaches to the PENDING record
 *    so it survives verification on another device, or abandonment
 *  - optional `context` { articleUrl, articleText, announcementType, ... }
 *    captured before the gate
 *  - identical response for a new vs returning email — never disclose
 *    whether an account exists
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'We need a valid email.' }, { status: 400 });
  }

  console.log('[auth/start STUB]', {
    email,
    resend: Boolean(body.resend),
    prefill: body.prefill || null,
    context: body.context || null,
  });

  // Same shape regardless of whether the account exists.
  return NextResponse.json({ sent: true, expiresInMinutes: 20 });
}
