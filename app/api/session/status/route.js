import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — the cross-device poll. The verify screen calls this every 3s so a tab
 * left waiting advances itself when the emailed link is opened elsewhere.
 * Backend returns { verified, redirectTo }.
 *
 * Stubbed as never-verified so polling is exercised without hijacking review.
 * `email` is null until a real session cookie exists — checkout also probes
 * GET /api/auth/me for the same field.
 */
export async function GET() {
  return NextResponse.json({ verified: false, redirectTo: null, email: null });
}
