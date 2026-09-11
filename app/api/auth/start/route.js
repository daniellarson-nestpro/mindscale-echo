import { NextResponse } from 'next/server';
import {
  PENDING_COOKIE,
  createPendingToken,
  getAuthSecret,
  getSession,
  hasLiveUnusedLink,
  isValidEmail,
  issueMagicLink,
  normalizeEmail,
  pendingCookieOptions,
  safeRelativePath,
} from '../../../../lib/auth';
import { V2_LINK_TTL_MS, startOkBody, startResponseAfterSend } from '../../../../lib/codes';
import { isDatabaseConfigured } from '../../../../lib/db';
import { buildLoginUrl, sendVerificationCodeEmail, siteOrigin } from '../../../../lib/email';
import { getLeadByEmail, upsertLead } from '../../../../lib/leads';
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

  // This endpoint is unauthenticated: anyone can POST any address. Carrying the
  // caller's fields straight into the lead row would let a stranger overwrite a
  // real customer's saved brief just by typing their email. So the fields are
  // only honoured while the address is still unclaimed — a brand-new lead, or
  // one that has never completed verification, is nothing but captured prefill.
  // Once a lead is verified it belongs to someone, and only a session for that
  // same address may write to it. Everyone else still gets a login code; the
  // upsert just runs empty, which merges the row onto itself and leaves both the
  // brief and furthest_step untouched.
  let existing;
  try {
    existing = await getLeadByEmail(email);
  } catch (err) {
    console.error('[auth/start] lead lookup failed:', err?.message);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const owned = getSession()?.email === email;
  const mayWrite = !existing?.verified_at || owned;

  try {
    await upsertLead(email, mayWrite ? leadFields : {});
  } catch (err) {
    console.error('[auth/start] lead upsert failed:', err?.message);
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  // VerifyForm saveProfile sends resend:false + name/phone. Attach to the
  // pending lead without burning the live code.
  if (body?.resend === false && (await hasLiveUnusedLink(email))) {
    return ok(email);
  }

  // One office NAT can burn this window on eight colleagues; the ninth gets no
  // code at all. Telling them to check their inbox strands them on /start/verify
  // waiting for mail that was never sent, so answer 429 the way the other
  // rate-limited routes do — no ok:true, no sent:true, no pending cookie.
  // The cooldown branch below is different: there a code really was just sent.
  const ip = clientIp(request);
  if (!ipLimit.check(`start:${ip}`).ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        message:
          'Too many sign-in attempts from your network just now. Give it a few minutes and try again.',
      },
      { status: 429 }
    );
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

  const production = process.env.NODE_ENV === 'production';
  if (!mail.sent) {
    console.error('[auth/start] code issued; email not sent:', mail.reason, email);
    if (!production) {
      console.info('[auth/start] dev code:', issued.code, 'url:', loginUrl);
    }
  }

  const answer = startResponseAfterSend({ email, sent: mail.sent, production });
  if (answer.status !== 200) {
    return NextResponse.json(answer.body, { status: answer.status });
  }

  const pendingToken = createPendingToken({ email, linkId: issued.id });
  return ok(email, { pendingToken });
}
