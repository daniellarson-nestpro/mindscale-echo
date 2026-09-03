import { NextResponse } from 'next/server';
import { issueMagicLink, isValidEmail, normalizeEmail } from '../../../../lib/auth';
import { isDatabaseConfigured } from '../../../../lib/db';
import { buildLoginUrl, sendMagicLinkEmail, siteOrigin } from '../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERIC_OK = {
  ok: true,
  message: 'If that email has a purchase, we sent a login link. It expires in 30 minutes.',
};

const cooldown = new Map();
const COOLDOWN_MS = 30 * 1000;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please provide a valid email.' }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Sign-in is not available yet. Please try again shortly.' },
      { status: 503 }
    );
  }

  const last = cooldown.get(email);
  if (last && Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json(GENERIC_OK);
  }

  const origin = siteOrigin(request);
  if (!origin || !buildLoginUrl(origin, 'probe')) {
    return NextResponse.json(
      { error: 'Sign-in is not available yet. Please try again shortly.' },
      { status: 503 }
    );
  }

  cooldown.set(email, Date.now());

  const issued = await issueMagicLink(email);
  if (issued.error) {
    return NextResponse.json(
      { error: 'Sign-in is not available yet. Please try again shortly.' },
      { status: 503 }
    );
  }

  const loginUrl = buildLoginUrl(origin, issued.token);
  if (!loginUrl) {
    return NextResponse.json(
      { error: 'Sign-in is not available yet. Please try again shortly.' },
      { status: 503 }
    );
  }

  const mail = await sendMagicLinkEmail({ to: email, loginUrl });

  if (!mail.sent) {
    console.info('[auth/login] magic link issued; email not sent:', mail.reason, email);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[auth/login] dev login URL:', loginUrl);
    }
  }

  const payload = { ...GENERIC_OK };
  if (process.env.NODE_ENV !== 'production') {
    payload.devLoginUrl = loginUrl;
    payload.emailDelivered = Boolean(mail.sent);
  }

  return NextResponse.json(payload);
}
