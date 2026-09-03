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

/**
 * POST the compose payload. Branch on `ok`, not HTTP status.
 * Timeout / network → { ok: false, error: 'timeout' | 'network' }.
 */
export async function callN8nCompose(
  payload,
  { fetchImpl = fetch, timeoutMs = N8N_TIMEOUT_MS, url, secret } = {}
) {
  const webhookUrl = n8nWebhookUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      return { ok: false, error, status: response.status };
    }
    return { ok: true, draft: data, status: response.status };
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return { ok: false, error: timedOut ? 'timeout' : 'network', status: 502 };
  } finally {
    clearTimeout(timer);
  }
}
