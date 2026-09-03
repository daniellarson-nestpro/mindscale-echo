import { isValidEmail, normalizeEmail } from './auth';
import { toHyperagentArticle, toV1Article, normalizeArticleInput } from './article-shape';
import { clientIp, createRateLimiter } from './rate-limit';
import { resolveArticle } from './scrape';
import { parsePublicHttpUrl } from './ssrf';

export { formatChipDate, normalizeArticleInput, toHyperagentArticle, toV1Article } from './article-shape';

const ipLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const emailLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

function rateLimited(style) {
  if (style === 'hyperagent') {
    return { status: 429, body: { error: 'Please wait a moment and try that link again.' } };
  }
  return { status: 429, body: { ok: false, error: 'rate_limited' } };
}

/**
 * Shared scrape for POST /api/articles/resolve (v1) and /api/article/resolve
 * (Hyperagent field names). Same SSRF + rate limit.
 */
export async function resolveArticleRequest(body, request, { style = 'v1' } = {}) {
  const raw = typeof body?.url === 'string' ? body.url : '';
  const url = style === 'hyperagent' ? normalizeArticleInput(raw) : raw.trim();
  const parsed = parsePublicHttpUrl(url);

  if (!url || parsed.error === 'invalid_url') {
    if (style === 'hyperagent') {
      return {
        status: 400,
        body: { error: 'That doesn’t look like a web address — mind checking it?' },
      };
    }
    return { status: 400, body: { ok: false, error: 'invalid_url' } };
  }

  const ip = clientIp(request);
  if (!ipLimit.check(`scrape:${ip}`).ok) return rateLimited(style);

  const email = normalizeEmail(body?.email);
  if (email && isValidEmail(email) && !emailLimit.check(`scrape:${email}`).ok) {
    return rateLimited(style);
  }

  if (parsed.error === 'blocked' && style === 'hyperagent') {
    return {
      status: 200,
      body: { url, headline: null, outlet: null, date: null, partial: true },
    };
  }

  const result = await resolveArticle(url);
  return style === 'hyperagent' ? toHyperagentArticle(result, url) : toV1Article(result);
}
