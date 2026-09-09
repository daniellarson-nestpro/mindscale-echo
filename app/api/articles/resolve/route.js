import { NextResponse } from 'next/server';
import { resolveArticleRequest } from '../../../../lib/article-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 });
  }

  const result = await resolveArticleRequest(body, request, { style: 'v1' });
  return NextResponse.json(result.body, { status: result.status });
}
