import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { leadToJson, orderToJson, progressForEmail } from '../../../lib/leads';
import { pathForStep } from '../../../lib/progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
  }

  const progress = await progressForEmail(session.email);
  return NextResponse.json({
    ok: true,
    email: session.email,
    furthestStep: progress.furthestStep,
    redirectTo: pathForStep(progress.furthestStep),
    ladder: progress.ladder,
    lead: leadToJson(progress.lead),
    orders: (progress.orders || []).map(orderToJson),
  });
}
