import { NextResponse } from 'next/server';
import {
  PENDING_COOKIE,
  createPendingToken,
  getAuthSecret,
  hasLiveUnusedLink,
  isValidEmail,
  issueMagicLink,
  normalizeEmail,
  pendingCookieOptions,
  safeRelativePath,
} from '../../../../lib/auth';
import { V2_LINK_TTL_MS, startOkBody } from '../../../../lib/codes';
import { isDatabaseConfigured } from '../../../../lib/db';
import { buildLoginUrl, sendVerificationCodeEmail, siteOrigin } from '../../../../lib/email';
import { upsertLead } from '../../../../lib/leads';
import { mergeStartLeadFields } from '../../../../lib/prefill';
import { clientIp, createRateLimiter } from '../../../../lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cooldown = new Map();
const COOLDOWN_MS = 30 * 1000;
const ipLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8 });

function ok(email, extra) {
  const response = NextResponse.json(startOkBody(email));
  if (extra?.pendingToken) {
    response.cookies.set(PENDING_COOKIE, extra.pendingToken, pendingCookieOptions());
  }
  return response;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  if (!isDatabaseConfigured() || !getAuthSecret()) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const origin = siteOrigin(request);
  if (!origin || !buildLoginUrl(origin, 'probe')) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const nextPath = body?.next ? safeRelativePath(body.next, '') : '';
  const leadFields = mergeStartLeadFields(body?.prefill, body?.context);
  try {
    await upsertLead(email, leadFields);
  } catch (err) {
    console.error('[auth/start] lead upsert failed:', err?.message);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  // VerifyForm saveProfile sends resend:false + name/phone. Attach to the
  // pending lead without burning the live code.
  if (body?.resend === false && (await hasLiveUnusedLink(email))) {
    return ok(email);
  }

  const ip = clientIp(request);
  if (!ipLimit.check(`start:${ip}`).ok) {
    return ok(email);
  }

  const last = cooldown.get(email);
  if (body?.resend !== true && last && Date.now() - last < COOLDOWN_MS) {
    return ok(email);
  }

  cooldown.set(email, Date.now());

  const issued = await issueMagicLink(email, {
    withCode: true,
    ttlMs: V2_LINK_TTL_MS,
    nextPath: nextPath || null,
  });
  if (issued.error || !issued.token || !issued.code) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const loginUrl = buildLoginUrl(origin, issued.token, nextPath || undefined);
  if (!loginUrl) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const mail = await sendVerificationCodeEmail({
    to: email,
    loginUrl,
    code: issued.code,
  });

  if (!mail.sent) {
    console.info('[auth/start] code issued; email not sent:', mail.reason, email);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[auth/start] dev code:', issued.code, 'url:', loginUrl);
    }
  }

  const pendingToken = createPendingToken({ email, linkId: issued.id });
  return ok(email, { pendingToken });
}
