import { NextResponse } from 'next/server';
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  consumeMagicLink,
  createSessionToken,
  getAuthSecret,
  pendingCookieOptions,
  safeRelativePath,
  sessionCookieOptions,
} from '../../../../lib/auth';
import { markLeadVerified, progressForEmail, upsertLead } from '../../../../lib/leads';
import { PREFILL_COOKIE, prefillCookieOptions, prefillToLeadFields, readPrefillToken } from '../../../../lib/prefill';
import { pathForStep } from '../../../../lib/progress';
import { cookies } from 'next/headers';
import { resolveOrigin } from '../../../../lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const origin = resolveOrigin(request);

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  if (!getAuthSecret()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  const jar = cookies();
  const prefill = readPrefillToken(jar.get(PREFILL_COOKIE)?.value);
  const extra = prefillToLeadFields(prefill);
  if (Object.keys(extra).length) {
    await upsertLead(consumed.email, extra);
  }
  await markLeadVerified(consumed.email);

  const progress = await progressForEmail(consumed.email);
  const fallback = pathForStep(progress.furthestStep);
  const requested = url.searchParams.get('next') || consumed.nextPath || '';
  const next = safeRelativePath(requested, fallback);

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set(SESSION_COOKIE, createSessionToken(consumed.email), sessionCookieOptions());
  response.cookies.set(PENDING_COOKIE, '', { ...pendingCookieOptions(), maxAge: 0 });
  response.cookies.set(PREFILL_COOKIE, '', { ...prefillCookieOptions(), maxAge: 0 });
  return response;
}
