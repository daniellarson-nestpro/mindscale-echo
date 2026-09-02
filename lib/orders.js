import { getStripe } from './stripe';
import { getSql, isDatabaseConfigured } from './db';
import { PLANS } from './plans';
import { normalizeEmail } from './auth';
import { formatAmount, hasBrief } from './release-status';
import {
  buildAccountUrl,
  confirmationSiteOrigin,
  isEmailConfigured,
  sendPurchaseConfirmationEmail,
} from './email';

function stripeId(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function planFromSession(session) {
  const fromMeta = session?.metadata?.plan;
  if (fromMeta && PLANS[fromMeta]) return fromMeta;
  return 'basic';
}

async function ensureStripeCustomer(session) {
  const existing = stripeId(session.customer);
  if (existing) return existing;

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  const stripe = getStripe();
  if (!stripe || !email) return null;

  try {
    const matches = await stripe.customers.list({ email, limit: 1 });
    if (matches.data[0]) return matches.data[0].id;
    const created = await stripe.customers.create({
      email,
      metadata: { product: 'mindscale-echo' },
    });
    return created.id;
  } catch (err) {
    console.error('[orders] could not ensure Stripe customer:', err?.message);
    return null;
  }
}

/**
 * Idempotent upsert keyed on Stripe Checkout Session ID.
 * Used by the webhook (source of truth) and the /success fast path.
 */
export async function upsertOrderFromCheckoutSession(session) {
  if (!session?.id) return null;
  const sql = await getSql();
  if (!sql) {
    console.error('[orders] POSTGRES_URL is not set; cannot persist checkout session', session.id);
    return null;
  }

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) {
    console.error('[orders] checkout session has no customer email', session.id);
    return null;
  }

  const plan = planFromSession(session);
  const catalogue = PLANS[plan];
  const amountCents =
    typeof session.amount_total === 'number'
      ? session.amount_total
      : Math.round((catalogue?.price || 0) * 100);
  const currency = (session.currency || 'usd').toLowerCase();
  const paymentStatus = session.payment_status || 'unpaid';
  const paidAt = paymentStatus === 'paid' ? new Date().toISOString() : null;
  const customerId = await ensureStripeCustomer(session);
  const paymentIntentId = stripeId(session.payment_intent);

  const rows = await sql`
    INSERT INTO orders (
      email,
      stripe_customer_id,
      stripe_session_id,
      stripe_payment_intent_id,
      plan,
      amount_cents,
      currency,
      payment_status,
      paid_at
    )
    VALUES (
      ${email},
      ${customerId},
      ${session.id},
      ${paymentIntentId},
      ${plan},
      ${amountCents},
      ${currency},
      ${paymentStatus},
      ${paidAt}
    )
    ON CONFLICT (stripe_session_id) DO UPDATE SET
      email = EXCLUDED.email,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, orders.stripe_customer_id),
      stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, orders.stripe_payment_intent_id),
      plan = EXCLUDED.plan,
      amount_cents = EXCLUDED.amount_cents,
      currency = EXCLUDED.currency,
      payment_status = EXCLUDED.payment_status,
      paid_at = COALESCE(orders.paid_at, EXCLUDED.paid_at),
      updated_at = now()
    RETURNING *
  `;
  // confirmation_email_sent_at is owned by notifyPaidOrder — never reset here.

  return rows[0] || null;
}

async function claimConfirmationEmailSend(orderId) {
  const sql = await getSql();
  if (!sql || !orderId) return null;
  const rows = await sql`
    UPDATE orders
    SET confirmation_email_sent_at = now(), updated_at = now()
    WHERE id = ${orderId}
      AND payment_status = 'paid'
      AND confirmation_email_sent_at IS NULL
    RETURNING *
  `;
  return rows[0] || null;
}

async function releaseConfirmationEmailSend(orderId) {
  const sql = await getSql();
  if (!sql || !orderId) return;
  await sql`
    UPDATE orders
    SET confirmation_email_sent_at = NULL, updated_at = now()
    WHERE id = ${orderId}
      AND confirmation_email_sent_at IS NOT NULL
      AND payment_status = 'paid'
  `;
}

/**
 * Send one purchase-confirmation email for a paid order.
 * Idempotent via confirmation_email_sent_at. Never throws — callers
 * (webhook, /success, claim) must still succeed if Resend fails.
 */
export async function notifyPaidOrder(order) {
  let claimed = null;
  try {
    if (!order?.id) return { sent: false, reason: 'no_order' };
    if (order.payment_status !== 'paid') return { sent: false, reason: 'not_paid' };
    if (order.confirmation_email_sent_at) return { sent: false, reason: 'already_sent' };

    const to = normalizeEmail(order.email);
    if (!to) {
      console.error('[orders] purchase confirmation skipped: no email', order.id);
      return { sent: false, reason: 'no_email' };
    }

    if (!isEmailConfigured()) {
      console.info('[orders] purchase confirmation skipped: Resend is not configured', order.id);
      return { sent: false, reason: 'not_configured' };
    }

    claimed = await claimConfirmationEmailSend(order.id);
    if (!claimed) return { sent: false, reason: 'already_sent' };

    const planName = PLANS[claimed.plan]?.name || claimed.plan || 'release';
    const amountLabel = formatAmount(claimed.amount_cents, claimed.currency);
    const accountUrl = buildAccountUrl(confirmationSiteOrigin());
    if (!accountUrl) {
      console.error('[orders] purchase confirmation skipped: bad site origin', claimed.id);
      await releaseConfirmationEmailSend(claimed.id);
      return { sent: false, reason: 'bad_origin' };
    }

    const result = await sendPurchaseConfirmationEmail({
      to,
      planName,
      amountLabel,
      accountUrl,
      customerEmail: to,
      briefReceived: hasBrief(claimed),
    });

    if (!result.sent) {
      await releaseConfirmationEmailSend(claimed.id);
      console.error('[orders] purchase confirmation not sent:', result.reason, claimed.id);
      return result;
    }

    console.info('[orders] purchase confirmation sent', { orderId: claimed.id, plan: claimed.plan });
    return result;
  } catch (err) {
    console.error('[orders] purchase confirmation failed:', err?.message);
    if (claimed?.id) {
      try {
        await releaseConfirmationEmailSend(claimed.id);
      } catch (releaseErr) {
        console.error('[orders] could not release confirmation claim:', releaseErr?.message);
      }
    }
    return { sent: false, reason: 'error' };
  }
}

export async function listOrdersForEmail(email) {
  const sql = await getSql();
  if (!sql) return [];
  return sql`
    SELECT *
    FROM orders
    WHERE email = ${normalizeEmail(email)}
    ORDER BY created_at DESC
  `;
}

export async function getOrderForEmail(orderId, email) {
  const sql = await getSql();
  if (!sql || !orderId) return null;
  const rows = await sql`
    SELECT *
    FROM orders
    WHERE id = ${orderId} AND email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrderBySessionIdForEmail(sessionId, email) {
  const sql = await getSql();
  if (!sql || !sessionId) return null;
  const rows = await sql`
    SELECT *
    FROM orders
    WHERE stripe_session_id = ${sessionId} AND email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function attachBrief({ actorEmail, orderId, sessionId, brief, logoMeta }) {
  if (!isDatabaseConfigured()) return { error: 'database', status: 503 };
  const email = normalizeEmail(actorEmail);
  if (!email) return { error: 'auth', status: 401 };

  let order = null;
  if (orderId) {
    order = await getOrderForEmail(orderId, email);
  } else if (sessionId) {
    order = await getOrderBySessionIdForEmail(sessionId, email);
  }

  if (!order) return { error: 'not_found', status: 404 };
  if (order.brief_submitted_at) return { error: 'already_submitted', status: 409 };

  const sql = await getSql();
  const rows = await sql`
    UPDATE orders SET
      company_name = ${brief.companyName},
      website = ${brief.website || null},
      contact_name = ${brief.contactName},
      contact_email = ${brief.contactEmail},
      article_url = ${brief.articleUrl || null},
      announcement_type = ${brief.announcementType},
      quote = ${brief.quote || null},
      quote_attribution = ${brief.quoteAttribution || null},
      notes = ${brief.notes || null},
      logo_name = ${logoMeta?.name || null},
      logo_type = ${logoMeta?.type || null},
      logo_size = ${logoMeta?.size || null},
      brief_submitted_at = now(),
      updated_at = now()
    WHERE id = ${order.id} AND email = ${email} AND brief_submitted_at IS NULL
    RETURNING *
  `;

  if (!rows[0]) return { error: 'already_submitted', status: 409 };
  return { order: rows[0] };
}

export { isDatabaseConfigured };
