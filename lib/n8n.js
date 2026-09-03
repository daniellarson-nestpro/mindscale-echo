/**
 * Server-only n8n compose client.
 * Never import this from client components. Never use /webhook-test/.
 */

export const DEFAULT_N8N_WEBHOOK_URL =
  'https://nestpro.app.n8n.cloud/webhook/press-release';

export const N8N_TIMEOUT_MS = 35_000;

export function n8nWebhookUrl(raw = process.env.N8N_WEBHOOK_URL) {
  const value = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_N8N_WEBHOOK_URL;
  return value.replace(/\/webhook-test\//g, '/webhook/');
}

export function n8nRequestHeaders(secret = process.env.N8N_WEBHOOK_SECRET) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (typeof secret === 'string' && secret.trim()) {
    headers['X-API-Key'] = secret.trim();
  }
  return headers;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function n8nWebhookHost(raw) {
  try {
    return new URL(n8nWebhookUrl(raw)).host;
  } catch {
    return '';
  }
}

function logN8nCompose({ host, durationMs, ok, error }) {
  console.info('[n8n compose]', {
    host,
    durationMs,
    ok: ok === true,
    error: ok === true ? null : error || 'compose_failed',
  });
}

/**
 * POST the compose payload. Branch on `ok`, not HTTP status.
 * Timeout / network → { ok: false, error: 'timeout' | 'network' }.
 */
export async function callN8nCompose(
  payload,
  { fetchImpl = fetch, timeoutMs = N8N_TIMEOUT_MS, url, secret } = {}
) {
  const webhookUrl = n8nWebhookUrl(url);
  const host = n8nWebhookHost(url);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let outcome = { ok: false, error: 'network', status: 502, host };
  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: n8nRequestHeaders(secret),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await readJson(response);
    if (!data || typeof data !== 'object' || data.ok !== true) {
      const error =
        (data && typeof data.error === 'string' && data.error.trim()) || 'compose_failed';
      outcome = { ok: false, error, status: response.status, host };
      return outcome;
    }
    outcome = { ok: true, draft: data, status: response.status, host };
    return outcome;
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    outcome = { ok: false, error: timedOut ? 'timeout' : 'network', status: 502, host };
    return outcome;
  } finally {
    clearTimeout(timer);
    logN8nCompose({
      host,
      durationMs: Date.now() - started,
      ok: outcome.ok,
      error: outcome.error,
    });
  }
}
