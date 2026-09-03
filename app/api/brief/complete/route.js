import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { draftFromBrief, hasRealBrief } from '../../../../lib/draft';
import { getLeadByEmail, leadToBriefJson } from '../../../../lib/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pre-payment compose. Does not call n8n (no production auth on that path).
 * Returns the same draft shape preview/plate render, mapped from the lead.
 *
 * HOOK: swap in a cheap-model draft_body when the composer is wired.
 */
export async function POST() {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }

  let brief = null;
  try {
    const lead = await getLeadByEmail(session.email);
    brief = leadToBriefJson(lead).brief;
  } catch (err) {
    console.error('[brief/complete] lead load failed:', err?.message);
  }

  const draft = hasRealBrief(brief) || session.email ? draftFromBrief(brief || {}) : null;

  return NextResponse.json({
    ok: true,
    token: 'demo',
    draft,
  });
}
