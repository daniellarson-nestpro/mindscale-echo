import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — no session cookie on this branch. Checkout probes here for a
 * prefill email. Do not treat this as V1 customer login /account auth.
 *
 * When the magic-link backend lands, return { email } from the signed cookie.
 */
export async function GET() {
  return NextResponse.json({ email: null });
}
