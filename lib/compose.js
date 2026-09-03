import { draftFromBrief } from './draft.js';
import { safePreviewToken } from './url.js';

export const COMPOSE_KEYS = [
  'companyName',
  'website',
  'contactName',
  'contactEmail',
  'phone',
  'announcementType',
  'articleUrl',
  'articleText',
  'articleSource',
  'quote',
  'quoteAttribution',
  'notes',
  'leadId',
  'orderId',
];

export const COMPOSE_STALE_MS = 90_000;
export const COMPOSE_WAIT_MS = 35_000;

function str(value) {
  if (value == null) return '';
  return String(value);
}

export function articleSourceFromLead(lead) {
  if (lead?.article_url) return 'url';
  if (lead?.article_text) return 'paste';
  return 'paste';
}

export function buildComposePayload({ lead, articleText, orderId = '' } = {}) {
  const payload = {
    companyName: str(lead?.company_name),
    website: str(lead?.website),
    contactName: str(lead?.contact_name),
    contactEmail: str(lead?.email),
    phone: str(lead?.phone),
    announcementType: str(lead?.announcement_type),
    articleUrl: str(lead?.article_url),
    articleText: str(articleText),
    articleSource: articleSourceFromLead(lead),
    quote: str(lead?.quote),
    quoteAttribution: str(lead?.quote_attribution),
    notes: str(lead?.notes),
    leadId: str(lead?.id),
    orderId: str(orderId),
  };
  for (const key of COMPOSE_KEYS) {
    if (payload[key] == null) payload[key] = '';
  }
  return payload;
}

export function parseComposeJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.ok === true) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.ok === true) return parsed;
  } catch {
    return null;
  }
  return null;
}

/** True only for a payload we saved after n8n returned ok: true. */
export function hasN8nCompose(lead) {
  const parsed = parseComposeJson(lead?.compose_json);
  return Boolean(parsed && parsed.source === 'n8n');
}

export function hasSavedCompose(lead) {
  return hasN8nCompose(lead);
}

export function briefNewerThanCompose(lead) {
  if (!lead?.updated_at || !lead?.compose_finished_at) return false;
  const updated = Date.parse(lead.updated_at);
  const finished = Date.parse(lead.compose_finished_at);
  if (!Number.isFinite(updated) || !Number.isFinite(finished)) return false;
  return updated > finished;
}

/**
 * Reuse a prior n8n run. Template / local drafts never qualify.
 * A finished_at of null means a new run is in flight (json may still be old).
 */
export function canReuseN8nCompose(lead) {
  if (!hasN8nCompose(lead)) return false;
  if (!lead?.compose_finished_at) return false;
  if (briefNewerThanCompose(lead)) return false;
  return true;
}

export function isComposeInFlight(lead, now = Date.now(), staleMs = COMPOSE_STALE_MS) {
  if (!lead?.compose_started_at) return false;
  if (lead.compose_finished_at) return false;
  const started = new Date(lead.compose_started_at).getTime();
  if (!Number.isFinite(started)) return false;
  return now - started < staleMs;
}

/** Mirrors claimComposeLock: new n8n run vs wait/reuse. */
export function composeLockAllowsNewRun(lead, now = Date.now()) {
  if (!lead) return false;
  if (isComposeInFlight(lead, now)) return false;
  if (canReuseN8nCompose(lead)) return false;
  return true;
}

export function previewTokenFor(lead) {
  return safePreviewToken(str(lead?.id), 'demo');
}

function paragraphsFromBody(body) {
  if (Array.isArray(body)) {
    return body.map((part) => str(part).trim()).filter(Boolean);
  }
  const text = str(body).trim();
  return text ? [text] : [];
}

export function normalizeComposeResponse(data) {
  return {
    ok: true,
    source: 'n8n',
    headline: str(data?.headline).trim(),
    subhead: str(data?.subhead).trim(),
    dateline: str(data?.dateline).trim(),
    body: paragraphsFromBody(data?.body),
    quote: str(data?.quote).trim(),
    quoteAttribution: str(data?.quoteAttribution).trim(),
    boilerplate: str(data?.boilerplate).trim(),
    contactLine: str(data?.contactLine).trim(),
    error: '',
  };
}

/**
 * Map a saved n8n compose JSON into the preview/plate draft shape.
 * Letterhead contact fields come from the brief; composed copy from n8n.
 */
export function composeJsonToDraft(saved, brief = {}, now = new Date()) {
  const fallback = draftFromBrief(brief, now);
  const body = paragraphsFromBody(saved?.body);
  return {
    companyName: fallback.companyName,
    website: fallback.website,
    logoUrl: null,
    headline: str(saved?.headline).trim() || fallback.headline,
    subhead: str(saved?.subhead).trim(),
    dateline: str(saved?.dateline).trim() || fallback.dateline,
    bodyParagraphs: body.length ? body : fallback.bodyParagraphs,
    quote: str(saved?.quote).trim() || fallback.quote,
    quoteAttribution: str(saved?.quoteAttribution).trim() || fallback.quoteAttribution,
    boilerplate: str(saved?.boilerplate).trim() || fallback.boilerplate,
    contactName: fallback.contactName,
    contactEmail: fallback.contactEmail,
    phone: fallback.phone,
    contactLine: str(saved?.contactLine).trim(),
  };
}

/**
 * articleText is required for the model. Scrape the URL if the lead has none;
 * if that is still empty, send notes/quote so n8n has something to work with.
 */
export async function resolveArticleText({
  articleText,
  articleUrl,
  notes,
  quote,
  scrape,
} = {}) {
  const existing = str(articleText).trim();
  if (existing) return { articleText: existing, scraped: false };

  if (articleUrl && typeof scrape === 'function') {
    try {
      const result = await scrape(articleUrl);
      const scraped = str(result?.text || result?.title || '').trim();
      if (scraped) return { articleText: scraped, scraped: true };
    } catch {
      /* fall through to notes/quote */
    }
  }

  const fallback = [notes, quote].map((part) => str(part).trim()).filter(Boolean).join('\n\n');
  return { articleText: fallback, scraped: false };
}

export async function waitForExistingCompose(
  leadId,
  {
    getLead,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timeoutMs = COMPOSE_WAIT_MS,
    intervalMs = 500,
    now = () => Date.now(),
  } = {}
) {
  if (typeof getLead !== 'function') {
    return { ok: false, error: 'compose_failed', status: 200 };
  }
  const started = now();
  let lead = await getLead(leadId);
  if (canReuseN8nCompose(lead)) return { ok: true, token: previewTokenFor(lead), lead };
  if (lead && !isComposeInFlight(lead, now())) {
    return { ok: false, error: 'compose_failed', status: 200 };
  }

  while (now() - started < timeoutMs) {
    await sleep(intervalMs);
    lead = await getLead(leadId);
    if (canReuseN8nCompose(lead)) {
      return { ok: true, token: previewTokenFor(lead), lead };
    }
    if (lead && !isComposeInFlight(lead, now())) {
      return { ok: false, error: 'compose_failed', status: 200 };
    }
  }
  return { ok: false, error: 'timeout', status: 502 };
}

export function statusForComposeError(error) {
  return error === 'timeout' || error === 'network' ? 502 : 200;
}
