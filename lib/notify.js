/**
 * Notification adapter: owner alerts over Telegram + email, and the customer
 * emails that accompany them.
 *
 * Configuration:
 *   OWNER_EMAIL           – where to send owner alerts (required for email path)
 *   TELEGRAM_BOT_TOKEN    – Telegram bot token  (launch blocker if unset)
 *   TELEGRAM_CHAT_ID      – Telegram chat/channel ID (launch blocker if unset)
 *
 * Every channel fails gracefully: errors are logged but never propagate to
 * callers. If Telegram is not configured, a clear launch-blocker message is
 * logged on every attempt rather than silently suppressing delivery.
 */

import { getSql } from './db.js';
import {
  sendApprovalConfirmationEmail,
  sendComposeFailedEmail,
  sendDraftReadyEmail,
  sendPrSentEmail,
} from './email.js';

function ownerEmail() {
  return process.env.OWNER_EMAIL || '';
}

function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function telegramChatId() {
  return process.env.TELEGRAM_CHAT_ID || '';
}

export function isTelegramConfigured() {
  return Boolean(telegramToken() && telegramChatId());
}

export function isOwnerEmailConfigured() {
  return Boolean(ownerEmail());
}

/**
 * Telegram's legacy Markdown parser rejects the entire message when an entity
 * is left open, so an unescaped customer value silently costs the owner the
 * alert: an address like sal_marino@x.com opens an italic run that never
 * closes and Telegram answers 400. Every interpolated value goes through this.
 */
export function escapeTelegramMarkdown(value) {
  return String(value ?? '').replace(/([_*[\]()`])/g, '\\$1');
}

const md = escapeTelegramMarkdown;

/**
 * Compose failures the customer can do nothing about. They are already looking
 * at the failure in ComposeWait and will retry, so a transient blip earns an
 * owner alert but not an alarming "action required" email.
 */
export const TRANSIENT_COMPOSE_ERRORS = new Set(['timeout', 'network', 'unavailable']);

/**
 * Send a Telegram message to the configured chat.
 * Returns { sent: true } or { sent: false, reason }.
 */
async function sendTelegram(text) {
  if (!telegramToken() || !telegramChatId()) {
    console.error(
      '[notify] LAUNCH BLOCKER: Telegram is not configured.' +
        ' Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to receive owner alerts.'
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${telegramToken()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId(),
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notify] Telegram send failed:', res.status, body.slice(0, 200));
      // Last resort: a formatting rejection must never cost the alert outright.
      // Resend the same content unparsed rather than leaving the owner blind.
      if (res.status === 400) return sendTelegramPlain(text);
      return { sent: false, reason: `telegram_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[notify] Telegram send error:', err?.message);
    return { sent: false, reason: 'telegram_error' };
  }
}

/** Unformatted retry, used only when Markdown parsing was rejected. */
async function sendTelegramPlain(text) {
  try {
    const url = `https://api.telegram.org/bot${telegramToken()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId(),
        text: text.replace(/\\([_*[\]()`])/g, '$1'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { sent: false, reason: `telegram_plain_${res.status}` };
    console.info('[notify] Telegram delivered unformatted after a parse rejection');
    return { sent: true };
  } catch (err) {
    console.error('[notify] Telegram plain retry failed:', err?.message);
    return { sent: false, reason: 'telegram_error' };
  }
}

/**
 * Send an owner email via the existing Resend path.
 * Returns { sent: true } or { sent: false, reason }.
 */
async function sendOwnerEmail(subject, text) {
  const to = ownerEmail();
  if (!to) {
    console.info('[notify] owner email skipped: OWNER_EMAIL not set');
    return { sent: false, reason: 'not_configured' };
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || '';
  if (!key || !from) {
    console.info('[notify] owner email skipped: Resend not configured');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[notify] owner email Resend failed:', res.status, detail.slice(0, 200));
      return { sent: false, reason: 'provider' };
    }
    return { sent: true };
  } catch (err) {
    console.error('[notify] owner email failed:', err?.message);
    return { sent: false, reason: 'email_error' };
  }
}

/** Never let a missing address reject the Promise.allSettled group. */
function skip(reason) {
  return Promise.resolve({ sent: false, reason });
}

/**
 * Draft ready: alert the owner, and tell the customer their draft is waiting.
 */
export async function notifyOwnerDraftReady({ leadId, email, companyName }) {
  const text =
    `*Draft Ready* ✅\n` +
    `Lead: ${md(leadId)}\n` +
    `Email: ${md(email)}\n` +
    `Company: ${md(companyName || '—')}\n` +
    `Status: compose succeeded`;
  const [tg, cust] = await Promise.allSettled([
    sendTelegram(text),
    email ? sendDraftReadyEmail({ to: email }) : skip('no_email'),
  ]);
  logNotify('draft_ready', tg, undefined, cust);
}

/**
 * Compose failed. The customer only hears about it when there is something
 * they can act on — see TRANSIENT_COMPOSE_ERRORS.
 */
export async function notifyOwnerComposeFailed({ leadId, email, error }) {
  const text =
    `*Compose Failed* ❌\n` +
    `Lead: ${md(leadId)}\n` +
    `Email: ${md(email)}\n` +
    `Error: ${md(error || 'unknown')}`;
  const subject = `[Mindscale Echo] Compose failed — ${email}`;
  const plain = `Compose failed for lead ${leadId} (${email}). Error: ${error || 'unknown'}`;
  const actionable = Boolean(email) && !TRANSIENT_COMPOSE_ERRORS.has(error);
  const [tg, em, cust] = await Promise.allSettled([
    sendTelegram(text),
    sendOwnerEmail(subject, plain),
    actionable ? sendComposeFailedEmail({ to: email }) : skip('transient'),
  ]);
  logNotify('compose_failed', tg, em, cust);
}

/**
 * Notify owner of a successful payment.
 */
export async function notifyOwnerPaymentSuccess({ leadId, email, plan, amountCents }) {
  const amount = amountCents ? `$${(amountCents / 100).toFixed(2)}` : '';
  const text =
    `*Payment Received* 💳\n` +
    `Lead: ${md(leadId || '—')}\n` +
    `Email: ${md(email)}\n` +
    `Plan: ${md(plan)} ${md(amount)}`;
  const subject = `[Mindscale Echo] Payment received — ${email}`;
  const plain = `Payment received from ${email}. Plan: ${plan} ${amount}. Lead: ${leadId || '—'}`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify('payment_success', tg, em);
}

/**
 * Customer approved. Confirm to them that the approval was recorded.
 */
export async function notifyOwnerApproval({ leadId, email, orderId }) {
  const text =
    `*Customer Approved* ✅\n` +
    `Lead: ${md(leadId)}\n` +
    `Order: ${md(orderId || '—')}\n` +
    `Email: ${md(email)}\n` +
    `Action required: manually submit to vendor.`;
  const subject = `[Mindscale Echo] Customer approved — ${email}`;
  const plain = `Customer ${email} approved their press release. Lead: ${leadId}. Order: ${orderId || '—'}. Ready for manual vendor submission.`;
  const [tg, em, cust] = await Promise.allSettled([
    sendTelegram(text),
    sendOwnerEmail(subject, plain),
    email ? sendApprovalConfirmationEmail({ to: email }) : skip('no_email'),
  ]);
  logNotify('customer_approval', tg, em, cust);
}

/**
 * The release has been submitted to the vendor. This is the moment the approval
 * copy promises — "We will notify you when it is sent" — so the customer email
 * is the point of this function, not a side effect of it.
 */
export async function notifyPrSent({ leadId, orderId, email }) {
  const text =
    `*Release Submitted* 📤\n` +
    `Lead: ${md(leadId)}\n` +
    `Order: ${md(orderId || '—')}\n` +
    `Email: ${md(email || '—')}`;
  const subject = `[Mindscale Echo] Release submitted — ${email || leadId}`;
  const plain = `Release submitted to vendor. Lead: ${leadId}. Order: ${orderId || '—'}. Customer: ${email || '—'}`;
  const [tg, em, cust] = await Promise.allSettled([
    sendTelegram(text),
    sendOwnerEmail(subject, plain),
    email ? sendPrSentEmail({ to: email }) : skip('no_email'),
  ]);
  logNotify('pr_sent', tg, em, cust);
}

/**
 * Notify owner of an error or failure event.
 */
export async function notifyOwnerError({ context, leadId, error }) {
  const text =
    `*Error — ${md(context)}* ⚠️\n` +
    `Lead: ${md(leadId || '—')}\n` +
    `Error: ${md(error || 'unknown')}`;
  const subject = `[Mindscale Echo] Error in ${context}`;
  const plain = `Error in ${context}. Lead: ${leadId || '—'}. Error: ${error || 'unknown'}`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify(`error_${context}`, tg, em);
}

function logNotify(event, tgResult, emResult, custResult) {
  const ok = (r) => r?.status === 'fulfilled' && Boolean(r.value?.sent);
  console.info('[notify]', event, {
    telegram: ok(tgResult) ? 'sent' : 'failed',
    ...(emResult !== undefined ? { ownerEmail: ok(emResult) ? 'sent' : 'failed' } : {}),
    ...(custResult !== undefined ? { customerEmail: ok(custResult) ? 'sent' : 'skipped' } : {}),
  });
}

/**
 * Record a status history entry.
 */
export async function recordStatusTransition({ leadId, orderId, fromStatus, toStatus, actor, note }) {
  try {
    const sql = await getSql();
    if (!sql) return;
    await sql`
      INSERT INTO status_history (lead_id, order_id, from_status, to_status, actor, note)
      VALUES (${leadId || null}, ${orderId || null}, ${fromStatus || null}, ${toStatus}, ${actor || null}, ${note || null})
    `;
  } catch (err) {
    console.error('[notify] status_history insert failed:', err?.message);
  }
}
