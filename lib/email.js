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

/**
 * Customer: draft is ready to read.
 */
export async function sendDraftReadyEmail({ to, accountUrl }) {
  if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };
  const safeUrl = escapeHtml(accountUrl || confirmationSiteOrigin() + '/account');
  return postResendEmail({
    to,
    subject: 'Your Mindscale Echo press release draft is ready',
    text: [
      'Your press release draft is ready for review.',
      '',
      `Open your workspace: ${accountUrl || confirmationSiteOrigin() + '/account'}`,
      '',
      'Review the draft, then complete checkout to get it distributed.',
    ].join('\n'),
    html: `
      <p>Your press release draft is ready for review.</p>
      <p><a href="${safeUrl}" style="display:inline-block;background:#121313;color:#7ff0c0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Review your draft</a></p>
      <p style="color:#666;font-size:13px">Questions? Reply to this email.</p>
    `,
  });
}

/**
 * Customer: approval confirmed.
 */
export async function sendApprovalConfirmationEmail({ to }) {
  if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };
  const accountUrl = confirmationSiteOrigin() + '/account';
  const safeUrl = escapeHtml(accountUrl);
  return postResendEmail({
    to,
    subject: 'You approved your Mindscale Echo press release',
    text: [
      'Your press release approval has been recorded.',
      '',
      'Your release is now queued for manual vendor submission. We will notify you when it is sent.',
      '',
      `View status: ${accountUrl}`,
      '',
      'Please note: once your release has been submitted to the vendor, Mindscale Echo may be able to stop it in limited cases, but cannot issue a refund because fulfillment has already been paid for.',
    ].join('\n'),
    html: `
      <p>Your press release approval has been recorded.</p>
      <p>Your release is now queued for manual vendor submission. We will notify you when it is sent.</p>
      <p><a href="${safeUrl}">View your release status</a></p>
      <p style="color:#666;font-size:13px">Note: once your release has been submitted to the vendor, Mindscale Echo may be able to stop it in limited cases, but cannot issue a refund because fulfillment has already been paid for.</p>
    `,
  });
}

/**
 * Customer: PR sent to vendor.
 */
export async function sendPrSentEmail({ to }) {
  if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };
  const accountUrl = confirmationSiteOrigin() + '/account';
  const safeUrl = escapeHtml(accountUrl);
  return postResendEmail({
    to,
    subject: 'Your Mindscale Echo press release has been submitted',
    text: [
      'Your press release has been submitted to the distribution vendor.',
      '',
      `View your release status: ${accountUrl}`,
      '',
      'Vendor distribution reports will be available in your dashboard once received.',
    ].join('\n'),
    html: `
      <p>Your press release has been submitted to the distribution vendor.</p>
      <p><a href="${safeUrl}">View your release status</a></p>
      <p style="color:#666;font-size:13px">Vendor distribution reports will be available in your dashboard once received.</p>
    `,
  });
}

/**
 * Customer: compose failed — honest message without exposing internals.
 */
export async function sendComposeFailedEmail({ to }) {
  if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };
  return postResendEmail({
    to,
    subject: 'Action required — your Mindscale Echo draft could not be completed',
    text: [
      'We were unable to complete your press release draft due to a technical issue.',
      '',
      'Your brief has been saved. Please sign back in to retry or contact our support team for help.',
      '',
      `Sign in: ${confirmationSiteOrigin() + '/login'}`,
    ].join('\n'),
    html: `
      <p>We were unable to complete your press release draft due to a technical issue.</p>
      <p>Your brief has been saved. Please sign back in to retry, or contact our support team.</p>
      <p><a href="${escapeHtml(confirmationSiteOrigin() + '/login')}">Sign in to retry</a></p>
    `,
  });
}
