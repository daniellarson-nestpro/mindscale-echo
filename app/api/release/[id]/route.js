import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The issued release — letterhead HTML and PDF. Paid artifact.
 *
 * STUB: always 402 until the backend can check `paid_at`. That check is the
 * whole gate; there is deliberately no client-side pretending anywhere in the
 * funnel, and the letterhead template must not be reachable from /preview.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'This release hasn’t been sent out yet.',
      detail:
        'The letterhead copy and PDF unlock when the release is sent. The draft stays readable at /preview.',
    },
    { status: 402 }
  );
}
