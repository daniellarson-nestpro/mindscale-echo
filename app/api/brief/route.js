import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { isDatabaseConfigured } from '../../../lib/db';
import {
  briefSavedBody,
  getLeadByEmail,
  leadToBriefJson,
  saveLeadFromPayload,
} from '../../../lib/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hyperagent alias of PATCH /api/onboarding (lead autosave).
 * GET resumes the authenticated lead as { brief } or { brief: null }.
 * No session → 401 so the V2 funnel can send them to /start, not V1 /login.
 */
export async function PATCH(request) {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const payload = body && typeof body === 'object' ? body : {};
  // articleFile / logo binary intentionally discarded in this slice.
  const saved = await saveLeadFromPayload(session.email, payload);
  if (saved.error === 'database') {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json(briefSavedBody());
}

export async function GET() {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  try {
    const lead = await getLeadByEmail(session.email);
    return NextResponse.json(leadToBriefJson(lead));
  } catch (err) {
    console.error('[brief] resume failed:', err?.message);
    return NextResponse.json({ brief: null });
  }
}
