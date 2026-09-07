export function normalizeArticleInput(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function formatChipDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Hyperagent chip: { url, headline, outlet, date, partial }. */
export function toHyperagentArticle(result, requestedUrl) {
  const url = (result && result.articleUrl) || requestedUrl || '';
  if (!result || !result.ok) {
    if (result?.status === 400 || result?.error === 'invalid_url') {
      return {
        status: 400,
        body: { error: 'That doesn’t look like a web address — mind checking it?' },
      };
    }
    return {
      status: 200,
      body: { url, headline: null, outlet: null, date: null, partial: true },
    };
  }
  return {
    status: 200,
    body: {
      url,
      headline: result.title || null,
      outlet: result.outlet || null,
      date: formatChipDate(result.date),
      partial: Boolean(result.warning) || !result.title,
    },
  };
}

export function toV1Article(result) {
  if (!result.ok && result.status === 400) {
    return { status: 400, body: { ok: false, error: 'invalid_url' } };
  }
  if (!result.ok) {
    return { status: 200, body: { ok: false, error: result.error || 'fetch_failed' } };
  }
  return { status: 200, body: result };
}
