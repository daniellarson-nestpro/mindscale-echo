import { NextResponse } from 'next/server';
import { normalizeEmail, isValidEmail } from '../../../../lib/auth';
import { clientIp, createRateLimiter } from '../../../../lib/rate-limit';
import { resolveArticle } from '../../../../lib/scrape';
import { parsePublicHttpUrl } from '../../../../lib/ssrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ipLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const emailLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 });
  }

  const parsed = parsePublicHttpUrl(body?.url);
  if (parsed.error === 'invalid_url') {
    return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 });
  }
  if (parsed.error === 'blocked') {
    return NextResponse.json({ ok: false, error: 'fetch_failed' });
  }

  const ip = clientIp(request);
  if (!ipLimit.check(`scrape:${ip}`).ok) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const email = normalizeEmail(body?.email);
  if (email && isValidEmail(email) && !emailLimit.check(`scrape:${email}`).ok) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const result = await resolveArticle(body.url);
  if (!result.ok && result.status === 400) {
    return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 });
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'fetch_failed' });
  }
  return NextResponse.json(result);
}
