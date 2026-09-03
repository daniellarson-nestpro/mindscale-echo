import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/auth';
import { resolveOrigin } from '../../../../lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearAndRedirect(request) {
  const origin = resolveOrigin(request);
  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request) {
  return clearAndRedirect(request);
}

export async function GET(request) {
  return clearAndRedirect(request);
}
