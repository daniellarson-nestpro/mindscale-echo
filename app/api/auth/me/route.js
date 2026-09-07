import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { progressForEmail } from '../../../../lib/leads';
import { pathForStep } from '../../../../lib/progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ email: null });
  }

  try {
    const progress = await progressForEmail(session.email);
    return NextResponse.json({
      email: session.email,
      furthestStep: progress.furthestStep,
      redirectTo: pathForStep(progress.furthestStep),
      ladder: progress.ladder,
    });
  } catch (err) {
    console.error('[auth/me] progress failed:', err?.message);
    return NextResponse.json({ email: session.email });
  }
}
