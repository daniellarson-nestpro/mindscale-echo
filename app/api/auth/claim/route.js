import { NextResponse } from 'next/server';
import { getStripe, resolveOrigin } from '../../../../lib/stripe';
import {
  SESSION_COOKIE,
  createSessionToken,
  getAuthSecret,
  normalizeEmail,
  safeRelativePath,
  sessionCookieOptions,
} from '../../../../lib/auth';
import { notifyPaidOrder, upsertOrderFromCheckoutSession } from '../../../../lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const origin = resolveOrigin(request);
  const sessionId = url.searchParams.get('session_id') || '';
  const next = safeRelativePath(url.searchParams.get('next'), '/account?welcome=1');

  const fail = (path) => NextResponse.redirect(`${origin}${path}`);

  if (!sessionId) return fail('/login');

  const stripe = getStripe();
  if (!stripe) return fail(`/success?session_id=${encodeURIComponent(sessionId)}`);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return fail('/login?error=session');
  }

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) return fail(`/success?session_id=${encodeURIComponent(sessionId)}`);

  let order = null;
  try {
    order = await upsertOrderFromCheckoutSession(session);
  } catch (err) {
    console.error('[auth/claim] persist failed:', err?.message);
  }
  await notifyPaidOrder(order);

  if (session.payment_status !== 'paid' || !getAuthSecret()) {
    const plan = session.metadata?.plan || '';
    return fail(
      `/success?session_id=${encodeURIComponent(sessionId)}${plan ? `&plan=${encodeURIComponent(plan)}` : ''}`
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.set(SESSION_COOKIE, createSessionToken(email), sessionCookieOptions());
  return response;
}
