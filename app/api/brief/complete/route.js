import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import {
  COMPOSE_WAIT_MS,
  buildComposePayload,
  canReuseN8nCompose,
  normalizeComposeResponse,
  previewTokenFor,
  resolveArticleText,
  statusForComposeError,
  waitForExistingCompose,
} from '../../../../lib/compose';
import { isDatabaseConfigured } from '../../../../lib/db';
import {
  claimComposeLock,
  getLeadByEmail,
  getLeadById,
  loadOrdersForEmail,
  markComposeFinished,
  saveComposeSuccess,
  upsertLead,
} from '../../../../lib/leads';
import { callN8nCompose } from '../../../../lib/n8n';
import { resolveArticle } from '../../../../lib/scrape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function paidOrderId(orders) {
  const paid = (orders || []).find((order) => order.payment_status === 'paid');
  return paid?.id || '';
}

function okResponse(lead) {
  return NextResponse.json({ ok: true, token: previewTokenFor(lead) });
}

function failResponse(error, status) {
  return NextResponse.json({ ok: false, error: error || 'compose_failed' }, { status });
}

/**
 * Pre-payment compose. ok:true only after n8n returns ok:true (or a saved
 * payload with source:'n8n'). Local template copy is never a successful compose.
 * The browser only POSTs this route; it does not call n8n or email anyone.
 */
export async function POST() {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  let lead;
  try {
    lead = await getLeadByEmail(session.email);
    if (!lead) {
      const created = await upsertLead(session.email);
      lead = created.lead;
    }
  } catch (err) {
    console.error('[brief/complete] lead load failed:', err?.message);
    return failResponse('unavailable', 503);
  }

  if (!lead?.id) {
    return failResponse('unavailable', 503);
  }

  if (canReuseN8nCompose(lead)) {
    console.info('[brief/complete] skip n8n reuse source=n8n');
    return okResponse(lead);
  }

  let claimed;
  try {
    claimed = await claimComposeLock(lead.id);
  } catch (err) {
    console.error('[brief/complete] lock failed:', err?.message);
    return failResponse('unavailable', 503);
  }

  if (!claimed.claimed) {
    if (canReuseN8nCompose(claimed.lead)) {
      console.info('[brief/complete] skip n8n reuse source=n8n');
      return okResponse(claimed.lead);
    }
    const waited = await waitForExistingCompose(lead.id, { getLead: getLeadById });
    if (waited.ok && canReuseN8nCompose(waited.lead)) return okResponse(waited.lead);
    if (waited.ok) return failResponse('compose_failed', 200);
    return failResponse(waited.error, waited.status || 200);
  }

  lead = claimed.lead;

  let articleText = '';
  try {
    const resolved = await resolveArticleText({
      articleText: lead.article_text,
      articleUrl: lead.article_url,
      notes: lead.notes,
      quote: lead.quote,
      scrape: resolveArticle,
    });
    articleText = resolved.articleText;
  } catch (err) {
    console.error('[brief/complete] scrape failed:', err?.message);
    articleText = [lead.notes, lead.quote].filter(Boolean).join('\n\n');
  }

  let orderId = '';
  try {
    orderId = paidOrderId(await loadOrdersForEmail(session.email));
  } catch (err) {
    console.error('[brief/complete] order lookup failed:', err?.message);
  }

  const payload = buildComposePayload({ lead, articleText, orderId });
  const result = await callN8nCompose(payload, { timeoutMs: COMPOSE_WAIT_MS });

  if (!result.ok) {
    try {
      await markComposeFinished(lead.id);
    } catch (err) {
      console.error('[brief/complete] unlock failed:', err?.message);
    }
    return failResponse(result.error, statusForComposeError(result.error));
  }

  try {
    const saved = await saveComposeSuccess(lead.id, normalizeComposeResponse(result.draft));
    return okResponse(saved || lead);
  } catch (err) {
    console.error('[brief/complete] save failed:', err?.message);
    try {
      await markComposeFinished(lead.id);
    } catch {
      /* still fail the request */
    }
    return failResponse('unavailable', 502);
  }
}
