import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { isDatabaseConfigured, getSql } from '../../../lib/db';
import {
  getLeadByEmail,
  recordApproval,
  getApprovalForLead,
  updateLeadOrderStatus,
} from '../../../lib/leads';
import { hasN8nCompose } from '../../../lib/compose';
import { recordStatusTransition, notifyOwnerApproval } from '../../../lib/notify';
import { APPROVAL_CHECKBOX_COPY } from '../../../lib/approval.js';

export { APPROVAL_CHECKBOX_COPY };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/approve — record customer approval of the press release.
 * Requires authentication. Payment is not required — approval happens on
 * the draft preview, before checkout.
 * Body: { approved: true, orderId?: string }
 *
 * Records an approvals row (order_id nullable until they pay).
 * Does NOT submit to vendor — that is a manual post-pay ops step.
 */
export async function POST(request) {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
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

  if (body?.approved !== true) {
    return NextResponse.json(
      { error: 'You must check the approval checkbox to proceed.' },
      { status: 422 }
    );
  }

  let lead;
  try {
    lead = await getLeadByEmail(session.email);
  } catch (err) {
    console.error('[approve] lead lookup failed:', err?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  if (!lead?.id) {
    return NextResponse.json({ error: 'No release found for your account.' }, { status: 404 });
  }

  const sql = await getSql();
  let orders = [];
  try {
    orders = await sql`
      SELECT * FROM orders WHERE email = ${session.email} AND payment_status = 'paid'
      ORDER BY paid_at DESC LIMIT 5
    `;
  } catch (err) {
    console.error('[approve] order lookup failed:', err?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const order = orders[0] || null;
  const hasDraft = hasN8nCompose(lead);
  if (!hasDraft && !order) {
    return NextResponse.json(
      { error: 'A finished draft is required before you can approve.' },
      { status: 422 }
    );
  }

  // Idempotency: already approved
  const existing = await getApprovalForLead(lead.id);
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyApproved: true,
      approvedAt: existing.approved_at,
      orderStatus: order ? 'approved' : lead.order_status || 'ready',
    });
  }

  // Extract IP for audit (not logged, only stored)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  const approval = await recordApproval({
    leadId: lead.id,
    orderId: order?.id || null,
    approverEmail: session.email,
    checkboxCopy: APPROVAL_CHECKBOX_COPY, // exact copy stored for audit
    ipAddress,
  });

  if (!approval) {
    return NextResponse.json({ error: 'Could not record approval. Please try again.' }, { status: 500 });
  }

  // Paid + approve (legacy fallback): mark the order approved now.
  // Pre-pay approve: keep lead status as-is; webhook promotes after payment.
  if (order) {
    await updateLeadOrderStatus(lead.id, 'approved');
    try {
      await sql`
        UPDATE orders SET order_status = 'approved', approved_at = now(), updated_at = now()
        WHERE id = ${order.id}
      `;
    } catch (err) {
      console.error('[approve] order status update failed:', err?.message);
    }

    await recordStatusTransition({
      leadId: lead.id,
      orderId: order.id,
      fromStatus: 'paid',
      toStatus: 'approved',
      actor: session.email,
    });
  }

  notifyOwnerApproval({
    leadId: lead.id,
    email: session.email,
    orderId: order?.id || null,
  }).catch(() => {});

  console.info('[approve] approved', { leadId: lead.id, orderId: order?.id || null });

  return NextResponse.json({
    ok: true,
    approvedAt: approval.approved_at,
    orderStatus: order ? 'approved' : lead.order_status || 'ready',
  });
}
