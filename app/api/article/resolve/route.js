import { NextResponse } from 'next/server';
import { resolveArticleRequest } from '../../../../lib/article-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hyperagent alias of POST /api/articles/resolve.
 * Response: { url, headline, outlet, date, partial }.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const result = await resolveArticleRequest(body, request, { style: 'hyperagent' });
  return NextResponse.json(result.body, { status: result.status });
}
