import { extractArticleText, parseArticleHtml } from './article-html';
import { assertPublicHttpUrl, parsePublicHttpUrl } from './ssrf';

export { extractArticleText, parseArticleHtml } from './article-html';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

async function readLimited(response, maxBytes) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length && length > maxBytes) {
    throw new Error('too_large');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (text.length > maxBytes) throw new Error('too_large');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new Error('too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url.href, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MindscaleEchoBot/1.0 (+https://mindscale-echo.vercel.app)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveArticle(rawUrl) {
  const first = parsePublicHttpUrl(rawUrl);
  if (first.error === 'invalid_url') return { ok: false, error: 'invalid_url', status: 400 };
  if (first.error) return { ok: false, error: 'fetch_failed' };

  let current = first.url.href;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const safe = await assertPublicHttpUrl(current);
      if (safe.error) return { ok: false, error: 'fetch_failed' };

      let response;
      try {
        response = await fetchOnce(safe.url, FETCH_TIMEOUT_MS);
      } catch {
        return { ok: false, error: 'fetch_failed' };
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return { ok: false, error: 'fetch_failed' };
        current = new URL(location, safe.url).href;
        continue;
      }

      if (!response.ok) return { ok: false, error: 'fetch_failed' };

      let html;
      try {
        html = await readLimited(response, MAX_BYTES);
      } catch {
        return { ok: false, error: 'fetch_failed' };
      }

      const parsed = parseArticleHtml(html, safe.url.href);
      const text = [parsed.title, parsed.outlet, parsed.date, parsed.byline, extractArticleText(html)]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('\n\n');
      return {
        ok: true,
        articleUrl: rawUrl.trim(),
        title: parsed.title,
        outlet: parsed.outlet,
        date: parsed.date,
        byline: parsed.byline,
        text,
        ...(parsed.warning ? { warning: parsed.warning } : {}),
      };
    }
    return { ok: false, error: 'fetch_failed' };
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }
}
