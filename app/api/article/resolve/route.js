import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolves a pasted article URL into outlet / headline / date so the funnel can
 * show a confirmation chip *before* the account gate. This is the free unit of
 * work that earns the signup, so it must fail gracefully: a URL we can't parse
 * is still accepted.
 *
 * Deliberately dependency-free — regex over the fetched HTML head rather than a
 * parser library. Good enough for og: tags, which is what publishers emit.
 */
const UA =
  'Mozilla/5.0 (compatible; MindscaleEcho/1.0; +https://mindscalepartners.com) AppleWebKit/537.36';

function meta(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decode(m[1].trim());
  }
  return null;
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8212;|&mdash;/g, '—');
}

export async function POST(request) {
  let url;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'No link provided.' }, { status: 400 });
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return NextResponse.json(
      { error: 'That doesn’t look like a web address — mind checking it?' },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Fetch failed but the link may still be valid — accept it, flag it.
      return NextResponse.json({ url: parsed.toString(), partial: true });
    }

    const html = (await res.text()).slice(0, 200_000);

    const headline =
      meta(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ]) || null;

    const outlet =
      meta(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
      ]) || parsed.hostname.replace(/^www\./, '');

    const rawDate = meta(html, [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
      /<time[^>]+datetime=["']([^"']+)["']/i,
    ]);

    let date = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) {
        date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }

    return NextResponse.json({
      url: parsed.toString(),
      headline,
      outlet,
      date,
      partial: !headline,
    });
  } catch {
    // Never block on parse — the person can still proceed.
    return NextResponse.json({ url: parsed.toString(), partial: true });
  }
}
