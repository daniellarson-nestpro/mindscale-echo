import { normalizeEmail } from './auth';
import { getSql, isDatabaseConfigured } from './db';
import { briefSavedBody, leadToBriefJson } from './brief-shape';
import { inferStepFromLead, isFurthestStep, ladderState, maxStep, resolveFurthestStep } from './progress';

export { briefSavedBody, leadToBriefJson };

const LIMITS = {
  contactName: 200,
  phone: 40,
  companyName: 200,
  website: 400,
  announcementType: 80,
  articleUrl: 2000,
  articleText: 50000,
  quote: 2000,
  quoteAttribution: 200,
  notes: 5000,
};

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function sanitizeLeadFields(raw = {}) {
  const fields = {};
  if (raw.contactName !== undefined) fields.contact_name = clip(raw.contactName, LIMITS.contactName);
  if (raw.phone !== undefined) fields.phone = clip(raw.phone, LIMITS.phone);
  if (raw.companyName !== undefined) fields.company_name = clip(raw.companyName, LIMITS.companyName);
  if (raw.website !== undefined) fields.website = clip(raw.website, LIMITS.website);
  if (raw.announcementType !== undefined) {
    fields.announcement_type = clip(raw.announcementType, LIMITS.announcementType);
  }
  if (raw.articleUrl !== undefined) fields.article_url = clip(raw.articleUrl, LIMITS.articleUrl);
  if (raw.articleText !== undefined) fields.article_text = clip(raw.articleText, LIMITS.articleText);
  if (raw.quote !== undefined) fields.quote = clip(raw.quote, LIMITS.quote);
  if (raw.quoteAttribution !== undefined) {
    fields.quote_attribution = clip(raw.quoteAttribution, LIMITS.quoteAttribution);
  }
  if (raw.notes !== undefined) fields.notes = clip(raw.notes, LIMITS.notes);
  if (raw.furthestStep !== undefined && isFurthestStep(raw.furthestStep)) {
    fields.furthest_step = raw.furthestStep;
  }
  if (raw.articleSource !== undefined) {
    const src = raw.articleSource;
    if (src === 'pdf' || src === 'paste') fields.article_source = src;
    else if (src === '' || src === null) fields.article_source = null;
  }
  return fields;
}

export function leadToJson(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    email: lead.email,
    contactName: lead.contact_name || '',
    phone: lead.phone || '',
    companyName: lead.company_name || '',
    website: lead.website || '',
    announcementType: lead.announcement_type || '',
    articleUrl: lead.article_url || '',
    articleText: lead.article_text || '',
    articleSource: lead.article_source || '',
    quote: lead.quote || '',
    quoteAttribution: lead.quote_attribution || '',
    notes: lead.notes || '',
    furthestStep: lead.furthest_step || 'brief',
    logoStorageKey: lead.logo_storage_key || null,
    logoStorageUrl: lead.logo_storage_url || null,
    logoName: lead.logo_name || null,
    orderStatus: lead.order_status || null,
    createdAt: lead.created_at || null,
    updatedAt: lead.updated_at || null,
    verifiedAt: lead.verified_at || null,
  };
}

export async function getLeadByEmail(email) {
  const sql = await getSql();
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM leads
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getLeadById(id) {
  const sql = await getSql();
  if (!sql || !id) return null;
  const rows = await sql`
    SELECT * FROM leads
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * One in-flight n8n run per lead. Allows a new run when compose_json is not
 * source:n8n, or when the brief updated_at is after compose_finished_at.
 * Does not bump updated_at (that would look like a brief edit).
 */
export async function claimComposeLock(leadId) {
  const sql = await getSql();
  if (!sql || !leadId) return { error: 'database', claimed: false, lead: null };
  const rows = await sql`
    UPDATE leads
    SET compose_started_at = now(),
        compose_finished_at = NULL,
        compose_json = NULL
    WHERE id = ${leadId}
      AND (
        compose_started_at IS NULL
        OR compose_finished_at IS NOT NULL
        OR compose_started_at < now() - interval '90 seconds'
      )
      AND (
        compose_json IS NULL
        OR compose_json = ''
        OR compose_json NOT LIKE '%"source":"n8n"%'
        OR (
          compose_finished_at IS NOT NULL
          AND updated_at > compose_finished_at
        )
      )
    RETURNING *
  `;
  if (rows[0]) return { claimed: true, lead: rows[0] };
  const current = await getLeadById(leadId);
  return { claimed: false, lead: current };
}

export async function saveComposeSuccess(leadId, compose) {
  const sql = await getSql();
  if (!sql || !leadId) return null;
  const json = typeof compose === 'string' ? compose : JSON.stringify(compose);
  const rows = await sql`
    UPDATE leads
    SET compose_json = ${json},
        compose_finished_at = now(),
        furthest_step = CASE
          WHEN furthest_step IN ('checkout', 'account') THEN furthest_step
          ELSE 'preview'
        END,
        updated_at = now()
    WHERE id = ${leadId}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function markComposeFinished(leadId) {
  const sql = await getSql();
  if (!sql || !leadId) return null;
  const rows = await sql`
    UPDATE leads
    SET compose_finished_at = now(),
        updated_at = now()
    WHERE id = ${leadId}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function upsertLead(email, rawFields = {}) {
  const sql = await getSql();
  if (!sql) return { error: 'database' };
  const normalized = normalizeEmail(email);
  const incoming = sanitizeLeadFields(rawFields);

  const existing = await getLeadByEmail(normalized);
  const merged = {
    contact_name: incoming.contact_name !== undefined ? incoming.contact_name : existing?.contact_name || null,
    phone: incoming.phone !== undefined ? incoming.phone : existing?.phone || null,
    company_name: incoming.company_name !== undefined ? incoming.company_name : existing?.company_name || null,
    website: incoming.website !== undefined ? incoming.website : existing?.website || null,
    announcement_type:
      incoming.announcement_type !== undefined
        ? incoming.announcement_type
        : existing?.announcement_type || null,
    article_url: incoming.article_url !== undefined ? incoming.article_url : existing?.article_url || null,
    article_text: incoming.article_text !== undefined ? incoming.article_text : existing?.article_text || null,
    article_source: incoming.article_source !== undefined ? incoming.article_source : existing?.article_source || null,
    quote: incoming.quote !== undefined ? incoming.quote : existing?.quote || null,
    quote_attribution:
      incoming.quote_attribution !== undefined
        ? incoming.quote_attribution
        : existing?.quote_attribution || null,
    notes: incoming.notes !== undefined ? incoming.notes : existing?.notes || null,
  };

  const inferred = inferStepFromLead(merged);
  const furthest = maxStep(
    incoming.furthest_step || existing?.furthest_step || 'brief',
    inferred
  );

  const rows = await sql`
    INSERT INTO leads (
      email,
      contact_name,
      phone,
      company_name,
      website,
      announcement_type,
      article_url,
      article_text,
      article_source,
      quote,
      quote_attribution,
      notes,
      furthest_step
    )
    VALUES (
      ${normalized},
      ${merged.contact_name},
      ${merged.phone},
      ${merged.company_name},
      ${merged.website},
      ${merged.announcement_type},
      ${merged.article_url},
      ${merged.article_text},
      ${merged.article_source},
      ${merged.quote},
      ${merged.quote_attribution},
      ${merged.notes},
      ${furthest}
    )
    ON CONFLICT (email) DO UPDATE SET
      contact_name = EXCLUDED.contact_name,
      phone = EXCLUDED.phone,
      company_name = EXCLUDED.company_name,
      website = EXCLUDED.website,
      announcement_type = EXCLUDED.announcement_type,
      article_url = EXCLUDED.article_url,
      article_text = EXCLUDED.article_text,
      article_source = EXCLUDED.article_source,
      quote = EXCLUDED.quote,
      quote_attribution = EXCLUDED.quote_attribution,
      notes = EXCLUDED.notes,
      furthest_step = EXCLUDED.furthest_step,
      updated_at = now()
    RETURNING *
  `;
  return { lead: rows[0] || null };
}

export async function markLeadVerified(email) {
  const sql = await getSql();
  if (!sql) return null;
  const normalized = normalizeEmail(email);
  const rows = await sql`
    UPDATE leads
    SET verified_at = COALESCE(verified_at, now()), updated_at = now()
    WHERE email = ${normalized}
    RETURNING *
  `;
  if (rows[0]) return rows[0];
  const created = await upsertLead(normalized);
  if (created.lead) {
    const again = await sql`
      UPDATE leads
      SET verified_at = COALESCE(verified_at, now()), updated_at = now()
      WHERE email = ${normalized}
      RETURNING *
    `;
    return again[0] || created.lead;
  }
  return null;
}

export async function loadOrdersForEmail(email) {
  const sql = await getSql();
  if (!sql) return [];
  return sql`
    SELECT *
    FROM orders
    WHERE email = ${normalizeEmail(email)}
    ORDER BY created_at DESC
  `;
}

export async function progressForEmail(email) {
  const normalized = normalizeEmail(email);
  let lead = null;
  let orders = [];
  if (isDatabaseConfigured()) {
    try {
      lead = await getLeadByEmail(normalized);
      orders = await loadOrdersForEmail(normalized);
    } catch (err) {
      console.error('[leads] progress lookup failed:', err?.message);
    }
  }
  const furthestStep = resolveFurthestStep(lead, orders);
  return {
    lead,
    orders,
    furthestStep,
    ladder: ladderState(lead, orders),
  };
}

/**
 * Copy an unpurchased lead brief onto a paid order when the order has none yet.
 */
export async function syncLeadOntoPaidOrder(order) {
  if (!order?.id || order.payment_status !== 'paid' || order.brief_submitted_at) return order;
  const lead = await getLeadByEmail(order.email);
  if (!lead) return order;
  if (!lead.company_name && !lead.announcement_type && !lead.article_url && !lead.article_text) {
    return order;
  }

  const hasCompleteBrief = Boolean(lead.company_name && lead.announcement_type && lead.contact_name);
  const sql = await getSql();
  if (!sql) return order;
  const rows = await sql`
    UPDATE orders SET
      company_name = COALESCE(orders.company_name, ${lead.company_name}),
      website = COALESCE(orders.website, ${lead.website}),
      contact_name = COALESCE(orders.contact_name, ${lead.contact_name}),
      contact_email = COALESCE(orders.contact_email, ${lead.email}),
      article_url = COALESCE(orders.article_url, ${lead.article_url}),
      announcement_type = COALESCE(orders.announcement_type, ${lead.announcement_type}),
      quote = COALESCE(orders.quote, ${lead.quote}),
      quote_attribution = COALESCE(orders.quote_attribution, ${lead.quote_attribution}),
      notes = COALESCE(orders.notes, ${lead.notes}),
      brief_submitted_at = CASE
        WHEN ${hasCompleteBrief} AND orders.brief_submitted_at IS NULL THEN now()
        ELSE orders.brief_submitted_at
      END,
      updated_at = now()
    WHERE id = ${order.id} AND email = ${order.email}
    RETURNING *
  `;
  const next = rows[0] || order;
  await upsertLead(order.email, { furthestStep: 'account' });
  return next;
}

export async function saveLeadFromPayload(email, payload = {}) {
  return upsertLead(email, {
    contactName: payload.contactName,
    phone: payload.phone,
    companyName: payload.companyName,
    website: payload.website,
    announcementType: payload.announcementType,
    articleUrl: payload.articleUrl,
    articleText: payload.articleText,
    articleSource: payload.articleSource,
    quote: payload.quote,
    quoteAttribution: payload.quoteAttribution,
    notes: payload.notes,
    furthestStep: payload.furthestStep,
  });
}

/**
 * Save logo storage metadata onto the lead record.
 */
export async function saveLogoOnLead({ leadId, storageKey, storageUrl, name, type, size }) {
  const sql = await getSql();
  if (!sql || !leadId) return null;
  try {
    const rows = await sql`
      UPDATE leads SET
        logo_storage_key = ${storageKey || null},
        logo_storage_url = ${storageUrl || null},
        logo_name = ${name || null},
        logo_type = ${type || null},
        logo_size = ${size || null},
        updated_at = now()
      WHERE id = ${leadId}
      RETURNING id, logo_storage_key, logo_storage_url, logo_name
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[leads] saveLogoOnLead failed:', err?.message);
    return null;
  }
}

/**
 * Update order_status on the lead (for customer-facing status ladder).
 */
export async function updateLeadOrderStatus(leadId, status) {
  const sql = await getSql();
  if (!sql || !leadId) return null;
  const VALID_STATUSES = ['draft', 'writing', 'ready', 'paid', 'approved', 'pr_sent', 'failed', 'refunded'];
  if (!VALID_STATUSES.includes(status)) {
    console.error('[leads] invalid status:', status);
    return null;
  }
  try {
    const rows = await sql`
      UPDATE leads SET
        order_status = ${status},
        updated_at = now()
      WHERE id = ${leadId}
      RETURNING id, order_status
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[leads] updateLeadOrderStatus failed:', err?.message);
    return null;
  }
}

/**
 * Record customer approval. Creates a row in the approvals table.
 * Returns the approval row or null on failure.
 */
export async function recordApproval({ leadId, orderId, approverEmail, checkboxCopy, ipAddress }) {
  const sql = await getSql();
  if (!sql) return null;
  try {
    const rows = await sql`
      INSERT INTO approvals (lead_id, order_id, approver_email, checkbox_version, checkbox_copy, ip_address)
      VALUES (${leadId}, ${orderId || null}, ${approverEmail}, 'v1', ${checkboxCopy}, ${ipAddress || null})
      RETURNING *
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[leads] recordApproval failed:', err?.message);
    return null;
  }
}

/**
 * Check if a lead has been approved already.
 */
export async function getApprovalForLead(leadId) {
  const sql = await getSql();
  if (!sql || !leadId) return null;
  try {
    const rows = await sql`
      SELECT * FROM approvals WHERE lead_id = ${leadId} ORDER BY approved_at ASC LIMIT 1
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[leads] getApprovalForLead failed:', err?.message);
    return null;
  }
}

/**
 * Attach a paid order to a pre-pay approval row (order_id starts null).
 */
export async function attachOrderIdToApproval(approvalId, orderId) {
  const sql = await getSql();
  if (!sql || !approvalId || !orderId) return null;
  try {
    const rows = await sql`
      UPDATE approvals
      SET order_id = ${orderId}
      WHERE id = ${approvalId} AND order_id IS NULL
      RETURNING *
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[leads] attachOrderIdToApproval failed:', err?.message);
    return null;
  }
}

/**
 * After payment, reuse a pre-pay approval: stamp order_id and mark approved.
 * Returns true when an approval already existed.
 */
export async function applyExistingApprovalToPaidOrder(order) {
  if (!order?.lead_id || !order?.id) return false;
  const existing = await getApprovalForLead(order.lead_id);
  if (!existing) return false;

  if (!existing.order_id) {
    await attachOrderIdToApproval(existing.id, order.id);
  }
  await updateLeadOrderStatus(order.lead_id, 'approved');

  const sql = await getSql();
  if (sql) {
    try {
      await sql`
        UPDATE orders
        SET order_status = 'approved',
            approved_at = COALESCE(approved_at, now()),
            updated_at = now()
        WHERE id = ${order.id}
      `;
    } catch (err) {
      console.error('[leads] applyExistingApprovalToPaidOrder order update failed:', err?.message);
    }
  }
  return true;
}

/**
 * Checkout / preview: session email first, then preview token (lead id).
 */
export async function getLeadForCheckout({ email, token } = {}) {
  if (email) {
    try {
      const byEmail = await getLeadByEmail(email);
      if (byEmail) return byEmail;
    } catch (err) {
      console.error('[leads] getLeadForCheckout email failed:', err?.message);
    }
  }
  if (token && token !== 'demo') {
    try {
      return await getLeadById(token);
    } catch (err) {
      console.error('[leads] getLeadForCheckout token failed:', err?.message);
    }
  }
  return null;
}

export function orderToJson(order) {
  if (!order) return null;
  return {
    id: order.id,
    stripeSessionId: order.stripe_session_id || null,
    plan: order.plan,
    amountCents: order.amount_cents,
    currency: order.currency,
    paymentStatus: order.payment_status,
    paidAt: order.paid_at || null,
    briefSubmittedAt: order.brief_submitted_at || null,
    companyName: order.company_name || '',
    createdAt: order.created_at || null,
  };
}
