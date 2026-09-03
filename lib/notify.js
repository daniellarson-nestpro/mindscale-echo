/**
 * Owner notification adapter: email and Telegram.
 *
 * Configuration:
 *   OWNER_EMAIL           – where to send owner alerts (required for email path)
 *   TELEGRAM_BOT_TOKEN    – Telegram bot token  (launch blocker if unset)
 *   TELEGRAM_CHAT_ID      – Telegram chat/channel ID (launch blocker if unset)
 *
 * Both channels fail gracefully: errors are logged but never propagate to callers.
 * If Telegram is not configured, a clear launch-blocker message is logged on every
 * attempt rather than silently suppressing delivery.
 */

import { getSql } from './db.js';

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
      return { sent: false, reason: `telegram_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[notify] Telegram send error:', err?.message);
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

/**
 * Notify owner of a successful compose (draft ready).
 */
export async function notifyOwnerDraftReady({ leadId, email, companyName }) {
  const text =
    `*Draft Ready* ✅\n` +
    `Lead: ${leadId}\n` +
    `Email: ${email}\n` +
    `Company: ${companyName || '—'}\n` +
    `Status: n8n compose succeeded`;
  const [tg] = await Promise.allSettled([sendTelegram(text)]);
  logNotify('draft_ready', tg);
}

/**
 * Notify owner of a compose failure.
 */
export async function notifyOwnerComposeFailed({ leadId, email, error }) {
  const text =
    `*Compose Failed* ❌\n` +
    `Lead: ${leadId}\n` +
    `Email: ${email}\n` +
    `Error: ${error || 'unknown'}`;
  const subject = `[Mindscale Echo] Compose failed — ${email}`;
  const plain = `Compose failed for lead ${leadId} (${email}). Error: ${error || 'unknown'}`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify('compose_failed', tg, em);
}

/**
 * Notify owner of a successful payment.
 */
export async function notifyOwnerPaymentSuccess({ leadId, email, plan, amountCents }) {
  const amount = amountCents ? `$${(amountCents / 100).toFixed(2)}` : '';
  const text =
    `*Payment Received* 💳\n` +
    `Lead: ${leadId || '—'}\n` +
    `Email: ${email}\n` +
    `Plan: ${plan} ${amount}`;
  const subject = `[Mindscale Echo] Payment received — ${email}`;
  const plain = `Payment received from ${email}. Plan: ${plan} ${amount}. Lead: ${leadId || '—'}`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify('payment_success', tg, em);
}

/**
 * Notify owner of a customer approval.
 */
export async function notifyOwnerApproval({ leadId, email, orderId }) {
  const text =
    `*Customer Approved* ✅\n` +
    `Lead: ${leadId}\n` +
    `Order: ${orderId || '—'}\n` +
    `Email: ${email}\n` +
    `Action required: manually submit to vendor.`;
  const subject = `[Mindscale Echo] Customer approved — ${email}`;
  const plain = `Customer ${email} approved their press release. Lead: ${leadId}. Order: ${orderId || '—'}. Ready for manual vendor submission.`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify('customer_approval', tg, em);
}

/**
 * Notify owner of an error or failure event.
 */
export async function notifyOwnerError({ context, leadId, error }) {
  const text =
    `*Error — ${context}* ⚠️\n` +
    `Lead: ${leadId || '—'}\n` +
    `Error: ${error || 'unknown'}`;
  const subject = `[Mindscale Echo] Error in ${context}`;
  const plain = `Error in ${context}. Lead: ${leadId || '—'}. Error: ${error || 'unknown'}`;
  const [tg, em] = await Promise.allSettled([sendTelegram(text), sendOwnerEmail(subject, plain)]);
  logNotify(`error_${context}`, tg, em);
}

function logNotify(event, tgResult, emResult) {
  const tgOk = tgResult?.status === 'fulfilled' && tgResult.value?.sent;
  const emOk = emResult ? emResult?.status === 'fulfilled' && emResult.value?.sent : null;
  console.info('[notify]', event, {
    telegram: tgOk ? 'sent' : 'failed',
    ...(emResult !== undefined ? { email: emOk ? 'sent' : 'failed' } : {}),
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
