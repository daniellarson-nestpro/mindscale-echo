import { NextResponse } from 'next/server';
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createSessionToken,
  getSession,
  peekPendingRedemption,
  pendingCookieOptions,
  readPendingToken,
  sessionCookieOptions,
} from '../../../../lib/auth';
import { markLeadVerified, progressForEmail } from '../../../../lib/leads';
import { pathForStep } from '../../../../lib/progress';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unverified() {
  return NextResponse.json({ verified: false });
}

async function verifiedPayload(email, nextPath) {
  await markLeadVerified(email);
  const progress = await progressForEmail(email);
  return {
    verified: true,
    furthestStep: progress.furthestStep,
    redirectTo: nextPath || pathForStep(progress.furthestStep),
  };
}

export async function GET() {
  const session = getSession();
  if (session?.email) {
    const body = await verifiedPayload(session.email);
    return NextResponse.json(body);
  }

  const pending = readPendingToken(cookies().get(PENDING_COOKIE)?.value);
  if (!pending) return unverified();

  const redeemed = await peekPendingRedemption(pending);
  if (!redeemed) return unverified();

  const body = await verifiedPayload(redeemed.email, redeemed.nextPath || undefined);
  const response = NextResponse.json(body);
  response.cookies.set(SESSION_COOKIE, createSessionToken(redeemed.email), sessionCookieOptions());
  response.cookies.set(PENDING_COOKIE, '', { ...pendingCookieOptions(), maxAge: 0 });
  return response;
}
