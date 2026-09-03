import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STUB — triggers the pre-payment compose. Do not call n8n from here
 * (no production auth on that path). HOOK only until a draft_body exists
 * on GET /api/brief.
 *
 * Real behavior: cheap model, single pass, store `draft_body` as markdown or
 * plain text. NO letterhead HTML and no PDF at this stage — the letterhead
 * exists only as a flat plate image pre-payment, and the strong compose pass
 * plus human review is triggered by PAYMENT, not by brief completion.
 *
 * Also enforces one free compose per business identity: a second attempt
 * returns the existing draft rather than composing again.
 *
 * The happy path is synchronous (5-20s). The async email fallback must still
 * exist for the ~22s edge, where the UI offers to email the draft instead.
 */
export async function POST() {
  // Simulated compose latency so the wait screen is reviewable.
  await new Promise((r) => setTimeout(r, 6000));

  console.log('[brief/complete STUB] composed');
  return NextResponse.json({ ok: true, token: 'demo' });
}
