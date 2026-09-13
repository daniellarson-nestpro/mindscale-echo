const MAX_BYTES = 512 * 1024;

function decodeEntitiesRaw(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code ? String.fromCharCode(code) : '';
    });
}

function decodeEntities(value) {
  return decodeEntitiesRaw(value).replace(/\s+/g, ' ').trim();
}

function metaContent(html, names) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const a = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        'i'
      )
    );
    if (a?.[1]) return decodeEntities(a[1]);
    const b = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["']`,
        'i'
      )
    );
    if (b?.[1]) return decodeEntities(b[1]);
  }
  return '';
}

function titleTag(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeEntities(match?.[1] || '');
}

function timeDatetime(html) {
  const match = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  return decodeEntities(match?.[1] || '');
}

export function parseArticleHtml(html, pageUrl) {
  const raw = typeof html === 'string' ? html.slice(0, MAX_BYTES) : '';
  const title = metaContent(raw, ['og:title', 'twitter:title']) || titleTag(raw) || '';
  let outlet = metaContent(raw, ['og:site_name', 'application-name']);
  if (!outlet) {
    try {
      outlet = new URL(pageUrl).hostname.replace(/^www\./i, '');
    } catch {
      outlet = '';
    }
  }
  const date =
    metaContent(raw, [
      'article:published_time',
      'og:published_time',
      'article:published',
      'pubdate',
      'publish_date',
      'date',
      'dc.date',
      'dc.date.issued',
    ]) || timeDatetime(raw);
  const byline = metaContent(raw, ['article:author', 'author', 'byl', 'sailthru.author', 'dc.creator']);

  if (!title) {
    return {
      title: null,
      outlet: outlet || null,
      date: date || null,
      byline: byline || null,
      warning: 'unparsed',
    };
  }

  return {
    title,
    outlet: outlet || null,
    date: date || null,
    byline: byline || null,
  };
}

/** Visible article body for the composer — text only, never files. */
export function extractArticleText(html) {
  let raw = typeof html === 'string' ? html.slice(0, MAX_BYTES) : '';
  raw = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const article = raw.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const main = raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const chunk = article?.[1] || main?.[1] || raw;
  const text = decodeEntitiesRaw(
    chunk
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|div|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return text.slice(0, 50_000);
}
