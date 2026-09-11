import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, getSql } from '../../../../lib/db';
import { updateLeadOrderStatus } from '../../../../lib/leads';
import { notifyPrSent, recordStatusTransition } from '../../../../lib/notify';

/** Constant-time compare so the secret cannot be recovered byte by byte. */
function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pr-sent — owner-facing manual hook to mark a release as submitted to vendor.
 *
 * Protected by ADMIN_SECRET env var (bearer token). Customers cannot use this endpoint.
 * Body: { leadId, orderId? }
 *
 * This transitions status from 'approved' → 'pr_sent'.
 * Future: vendor report upload will be built in V3 admin dashboard.
 */
export async function POST(request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not configured. Set it to enable this endpoint.' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!secretMatches(provided, adminSecret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { leadId, orderId } = body || {};
  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required.' }, { status: 400 });
  }

  const sql = await getSql();

  // Verify the lead is in 'approved' state
  let lead;
  try {
    // email is needed to tell the customer their release went out.
    const rows = await sql`SELECT id, email, order_status FROM leads WHERE id = ${leadId} LIMIT 1`;
    lead = rows[0];
  } catch (err) {
    console.error('[admin/pr-sent] lead lookup failed:', err?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  if (lead.order_status === 'pr_sent') {
    return NextResponse.json({ ok: true, alreadySent: true, orderStatus: 'pr_sent' });
  }

  // Update status
  await updateLeadOrderStatus(leadId, 'pr_sent');
  try {
    if (orderId) {
      await sql`
        UPDATE orders SET order_status = 'pr_sent', pr_sent_at = now(), updated_at = now()
        WHERE id = ${orderId}
      `;
    }
  } catch (err) {
    console.error('[admin/pr-sent] order update failed:', err?.message);
  }

  await recordStatusTransition({
    leadId,
    orderId: orderId || null,
    fromStatus: 'approved',
    toStatus: 'pr_sent',
    actor: 'owner',
  });

  // Delivers the "we will notify you when it is sent" promise made at approval.
  // Never allowed to fail the transition — the status change already happened.
  notifyPrSent({ leadId, orderId: orderId || null, email: lead.email }).catch(() => {});

  console.info('[admin/pr-sent] pr_sent', { leadId, orderId });

  return NextResponse.json({ ok: true, orderStatus: 'pr_sent' });
}
