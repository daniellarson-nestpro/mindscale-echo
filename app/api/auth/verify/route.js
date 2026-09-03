import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — replaced by the backend's verification. Frontend expects:
 *  - { next } or { redirectTo } so /auth/callback and this screen route to the
 *    furthest incomplete step rather than always dumping to /brief
 *  - { expired: true } distinguished from a simply wrong code, so the UI can
 *    show the calm "that timed out, here's a fresh one" screen
 *  - prefill { contactName, phone } persisted on success
 *
 * While stubbed: any 6 digits verify, except 000000 (wrong) and 111111
 * (expired) so both failure states are reviewable.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const code = String(body.code || '');

  if (code === '111111') {
    return NextResponse.json({ error: 'Code expired.', expired: true }, { status: 401 });
  }
  if (!/^\d{6}$/.test(code) || code === '000000') {
    return NextResponse.json({ error: 'That code isn’t matching.' }, { status: 401 });
  }

  console.log('[auth/verify STUB]', { email: body.email, prefill: body.prefill || null });

  return NextResponse.json({ verified: true, next: '/brief', furthestStep: 'brief' });
}
