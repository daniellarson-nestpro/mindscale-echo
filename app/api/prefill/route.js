import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  PREFILL_COOKIE,
  createPrefillToken,
  prefillCookieOptions,
  readPrefillToken,
  sanitizePrefill,
} from '../../../lib/prefill';
import { getAuthSecret } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Outbound /start helper. Does not create an account.
 * Frontend should history.replaceState the URL clean after writing the cookie.
 */
export async function POST(request) {
  if (!getAuthSecret()) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload = sanitizePrefill(body);
  const token = createPrefillToken(payload);
  const response = NextResponse.json({ ok: true, prefill: payload });
  if (token) {
    response.cookies.set(PREFILL_COOKIE, token, prefillCookieOptions());
  }
  return response;
}

export async function GET() {
  const prefill = readPrefillToken(cookies().get(PREFILL_COOKIE)?.value);
  return NextResponse.json({ ok: true, prefill: prefill && Object.keys(prefill).length ? prefill : null });
}
