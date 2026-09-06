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
  setCurrentComposeRun,
  upsertLead,
} from '../../../../lib/leads';
import { callN8nCompose } from '../../../../lib/n8n';
import { createComposeRun, finishComposeRun } from '../../../../lib/compose-runs';
import { notifyOwnerDraftReady, notifyOwnerComposeFailed } from '../../../../lib/notify';

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
 * The browser only POSTs this route; it does not call n8n.
 *
 * The exact outbound payload is snapshotted in compose_runs BEFORE the n8n call.
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

  // Validate article source: require article_text or article_url
  const hasArticle = Boolean(lead.article_text?.trim() || lead.article_url?.trim());
  if (!hasArticle) {
    try {
      await markComposeFinished(lead.id);
    } catch {}
    return NextResponse.json(
      {
        ok: false,
        error: 'insufficient_article',
        message:
          'Your brief needs a news article or announcement text before we can write a press release. Please go back and add article text or upload a PDF.',
      },
      { status: 422 }
    );
  }

  let articleText = '';
  try {
    // V1: only pdf-extracted or pasted text; no URL scrape requirement
    const resolved = await resolveArticleText({
      articleText: lead.article_text,
      articleUrl: null, // URL scraping disabled for V1
      notes: lead.notes,
      quote: lead.quote,
      scrape: null,
    });
    articleText = resolved.articleText;
  } catch (err) {
    console.error('[brief/complete] article resolve failed:', err?.message);
    articleText = [lead.notes, lead.quote].filter(Boolean).join('\n\n');
  }

  if (!articleText.trim()) {
    try {
      await markComposeFinished(lead.id);
    } catch {}
    return NextResponse.json(
      {
        ok: false,
        error: 'insufficient_article',
        message:
          'The article text is too short or empty for a factual press release. Please paste more context or upload the full PDF.',
      },
      { status: 422 }
    );
  }

  let orderId = '';
  try {
    orderId = paidOrderId(await loadOrdersForEmail(session.email));
  } catch (err) {
    console.error('[brief/complete] order lookup failed:', err?.message);
  }

  const payload = buildComposePayload({ lead, articleText, orderId });

  // SAVE the exact outbound payload BEFORE calling n8n
  let composeRun = null;
  try {
    composeRun = await createComposeRun({ leadId: lead.id, requestPayload: payload });
    if (composeRun?.id) {
      payload.composeRunId = composeRun.id;
      // Checkout reads leads.current_compose_run_id to stamp orders.compose_run_id.
      // Without this write that column is always NULL and the order -> compose-run
      // audit link never exists.
      await setCurrentComposeRun(lead.id, composeRun.id);
    }
  } catch (err) {
    console.error('[brief/complete] compose run snapshot failed:', err?.message);
  }

  const callStart = Date.now();
  const result = await callN8nCompose(payload, { timeoutMs: COMPOSE_WAIT_MS });
  const durationMs = Date.now() - callStart;

  // Save n8n outcome to compose_run
  try {
    await finishComposeRun({
      runId: composeRun?.id,
      ok: result.ok,
      responsePayload: result.ok ? result.draft : { error: result.error },
      error: result.ok ? null : result.error,
      httpStatus: result.status,
      durationMs,
    });
  } catch (err) {
    console.error('[brief/complete] finish compose run failed:', err?.message);
  }

  if (!result.ok) {
    try {
      await markComposeFinished(lead.id);
    } catch (err) {
      console.error('[brief/complete] unlock failed:', err?.message);
    }
    // Notify owner of compose failure
    notifyOwnerComposeFailed({ leadId: lead.id, email: session.email, error: result.error }).catch(
      () => {}
    );
    return failResponse(result.error, statusForComposeError(result.error));
  }

  try {
    const saved = await saveComposeSuccess(lead.id, normalizeComposeResponse(result.draft));
    // Notify owner draft is ready
    notifyOwnerDraftReady({
      leadId: lead.id,
      email: session.email,
      companyName: lead.company_name,
    }).catch(() => {});
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
