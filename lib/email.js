import { authSiteOrigin, configuredSiteOrigin } from './stripe';

function fromAddress() {
  return process.env.EMAIL_FROM || '';
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

const ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)(?::\d+)?$/i;

const PRODUCTION_SITE = 'https://mindscale-echo.vercel.app';

export function buildLoginUrl(origin, token, next) {
  const base = (origin || '').replace(/\/$/, '');
  if (!ORIGIN_PATTERN.test(base)) return '';
  const params = new URLSearchParams({ token });
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    params.set('next', next);
  }
  return `${base}/api/auth/callback?${params.toString()}`;
}

export function buildAccountUrl(origin) {
  const base = (origin || '').replace(/\/$/, '');
  if (!ORIGIN_PATTERN.test(base)) return '';
  return `${base}/account`;
}

/** Origin for purchase-confirmation links. Env only — never Host headers. */
export function confirmationSiteOrigin() {
  return configuredSiteOrigin() || PRODUCTION_SITE;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain purchase-confirmation copy. No magic-link token — this email does
 * not expire. Workspace access stays on /login.
 *
 * Sample (brief not in yet):
 *   Subject: Your Mindscale Echo Premium payment succeeded
 *   Payment succeeded for your Mindscale Echo Premium package ($699.00).
 *   Open your workspace → {origin}/account
 *   Log in later with this same email. Use Log in on the site — we will
 *   send a one-time link. This confirmation does not expire.
 *   Your brief is not in yet. Please submit it from your workspace so we
 *   can start the draft.
 *
 * Sample (brief already received):
 *   We received your brief. A draft will come for your approval before
 *   distribution.
 */
export function purchaseConfirmationCopy({
  planName,
  amountLabel,
  accountUrl,
  customerEmail,
  briefReceived,
}) {
  const packageLabel = planName || 'release';
  const amount = amountLabel || '';
  const briefLine = briefReceived
    ? 'We received your brief. A draft will come for your approval before distribution.'
    : 'Your brief is not in yet. Please submit it from your workspace so we can start the draft.';

  const subject = `Your Mindscale Echo ${packageLabel} payment succeeded`;

  const text = [
    `Payment succeeded for your Mindscale Echo ${packageLabel} package (${amount}).`,
    '',
    'Open your workspace:',
    accountUrl,
    '',
    `You can log in later with this same email (${customerEmail}). Use Log in on the site — we will send a one-time link. This confirmation does not expire.`,
    '',
    briefLine,
    '',
    '— Mindscale Echo',
  ].join('\n');

  const safeUrl = escapeHtml(accountUrl);
  const html = `
        <p>Payment succeeded for your Mindscale Echo ${escapeHtml(packageLabel)} package (${escapeHtml(amount)}).</p>
        <p><a href="${safeUrl}" style="display:inline-block;background:#121313;color:#7ff0c0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Open your workspace</a></p>
        <p>You can log in later with this same email (${escapeHtml(customerEmail)}). Use Log in on the site — we will send a one-time link. This confirmation does not expire.</p>
        <p>${escapeHtml(briefLine)}</p>
        <p style="color:#666;font-size:13px">Mindscale Echo</p>
      `;

  return { subject, text, html };
}

async function postResendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = fromAddress();
  if (!key || !from) {
    return { sent: false, reason: 'not_configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[email] Resend failed:', res.status, detail.slice(0, 300));
    return { sent: false, reason: 'provider' };
  }

  return { sent: true };
}

export function verificationCodeCopy({ code, loginUrl }) {
  const digits = String(code || '').replace(/\D/g, '');
  const subject = `Your Mindscale Echo code: ${digits}`;
  const text = [
    `Here's your code: ${digits}. Good for 20 minutes. Or just tap the button below.`,
    '',
    loginUrl,
    '',
    'If you did not request this, you can ignore the email.',
  ].join('\n');
  const safeUrl = escapeHtml(loginUrl);
  const html = `
        <p>Here's your code: ${escapeHtml(digits)}. Good for 20 minutes. Or just tap the button below.</p>
        <p style="font-size:28px;letter-spacing:0.12em;font-weight:700">${escapeHtml(digits)}</p>
        <p><a href="${safeUrl}" style="display:inline-block;background:#121313;color:#7ff0c0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Open Mindscale Echo</a></p>
        <p style="color:#666;font-size:13px">If you did not request this, you can ignore the email.</p>
      `;
  return { subject, text, html };
}

export async function sendVerificationCodeEmail({ to, loginUrl, code }) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }
  let parsed;
  try {
    parsed = new URL(loginUrl);
  } catch {
    return { sent: false, reason: 'bad_origin' };
  }
  if (!ORIGIN_PATTERN.test(parsed.origin) || parsed.pathname !== '/api/auth/callback') {
    return { sent: false, reason: 'bad_origin' };
  }

  const copy = verificationCodeCopy({ code, loginUrl });
  return postResendEmail({
    to,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
}

export async function sendMagicLinkEmail({ to, loginUrl }) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }
  let parsed;
  try {
    parsed = new URL(loginUrl);
  } catch {
    return { sent: false, reason: 'bad_origin' };
  }
  if (!ORIGIN_PATTERN.test(parsed.origin) || parsed.pathname !== '/api/auth/callback') {
    return { sent: false, reason: 'bad_origin' };
  }

  return postResendEmail({
    to,
    subject: 'Log in to your Mindscale Echo workspace',
    text: [
      'Use this link to open your Mindscale Echo workspace. It expires in 30 minutes and can be used once.',
      '',
      loginUrl,
      '',
      'If you did not request this, you can ignore the email.',
    ].join('\n'),
    html: `
        <p>Use this link to open your Mindscale Echo workspace. It expires in 30 minutes and can be used once.</p>
        <p><a href="${loginUrl}">Open your workspace</a></p>
        <p style="color:#666;font-size:13px">If you did not request this, you can ignore the email.</p>
      `,
  });
}

export async function sendPurchaseConfirmationEmail({
  to,
  planName,
  amountLabel,
  accountUrl,
  customerEmail,
  briefReceived,
}) {
  let parsed;
  try {
    parsed = new URL(accountUrl);
  } catch {
    return { sent: false, reason: 'bad_origin' };
  }
  if (
    !ORIGIN_PATTERN.test(parsed.origin) ||
    parsed.pathname !== '/account' ||
    parsed.search ||
    parsed.hash
  ) {
    return { sent: false, reason: 'bad_origin' };
  }

  const copy = purchaseConfirmationCopy({
    planName,
    amountLabel,
    accountUrl,
    customerEmail,
    briefReceived,
  });

  return postResendEmail({
    to,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
}

export function siteOrigin(request) {
  return authSiteOrigin(request);
}
