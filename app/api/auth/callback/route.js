import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  consumeMagicLink,
  createSessionToken,
  getAuthSecret,
  safeRelativePath,
  sessionCookieOptions,
} from '../../../../lib/auth';
import { resolveOrigin } from '../../../../lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const next = safeRelativePath(url.searchParams.get('next'), '/account');
  const origin = resolveOrigin(request);

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  if (!getAuthSecret()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set(SESSION_COOKIE, createSessionToken(consumed.email), sessionCookieOptions());
  return response;
}
