import { NextResponse } from 'next/server';
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  consumeMagicCode,
  createSessionToken,
  getAuthSecret,
  isValidEmail,
  normalizeEmail,
  pendingCookieOptions,
  safeRelativePath,
  sessionCookieOptions,
} from '../../../../lib/auth';
import { verifyErrorBody, verifySuccessBody } from '../../../../lib/codes';
import { isDatabaseConfigured } from '../../../../lib/db';
import { markLeadVerified, progressForEmail, upsertLead } from '../../../../lib/leads';
import {
  PREFILL_COOKIE,
  prefillCookieOptions,
  prefillToLeadFields,
  readPrefillToken,
  sanitizePrefill,
} from '../../../../lib/prefill';
import { cookies } from 'next/headers';
import { pathForStep } from '../../../../lib/progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error) {
  return NextResponse.json(verifyErrorBody(error), { status: 400 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid');
  }

  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email) || !getAuthSecret()) {
    return fail('invalid');
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const consumed = await consumeMagicCode(email, body?.code);
  if (consumed.error === 'database') {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
  if (consumed.error) return fail(consumed.error);

  const jar = cookies();
  const cookiePrefill = readPrefillToken(jar.get(PREFILL_COOKIE)?.value);
  const extra = {
    ...prefillToLeadFields(cookiePrefill),
    ...prefillToLeadFields(sanitizePrefill(body?.prefill || {})),
  };
  if (Object.keys(extra).length) {
    await upsertLead(email, extra);
  }
  await markLeadVerified(email);

  const progress = await progressForEmail(email);
  const nextPath = consumed.nextPath ? safeRelativePath(consumed.nextPath, '') : '';
  const redirectTo = nextPath || pathForStep(progress.furthestStep);

  const response = NextResponse.json(
    verifySuccessBody({ furthestStep: progress.furthestStep, redirectTo })
  );
  response.cookies.set(SESSION_COOKIE, createSessionToken(email), sessionCookieOptions());
  response.cookies.set(PENDING_COOKIE, '', { ...pendingCookieOptions(), maxAge: 0 });
  response.cookies.set(PREFILL_COOKIE, '', { ...prefillCookieOptions(), maxAge: 0 });
  return response;
}
