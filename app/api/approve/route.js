import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { isDatabaseConfigured, getSql } from '../../../lib/db';
import {
  getLeadByEmail,
  recordApproval,
  getApprovalForLead,
  updateLeadOrderStatus,
} from '../../../lib/leads';
import { recordStatusTransition, notifyOwnerApproval } from '../../../lib/notify';
import { APPROVAL_CHECKBOX_COPY } from '../../../lib/approval.js';

export { APPROVAL_CHECKBOX_COPY };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/approve — record customer approval of the press release.
 * Requires authentication and a paid order.
 * Body: { approved: true, orderId?: string }
 *
 * Sets order_status to 'approved' and records the approval for audit.
 * Does NOT submit to vendor — that is a manual step.
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

  // Check there is a paid order
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

  if (!orders.length) {
    return NextResponse.json(
      { error: 'Payment is required before approving. Please complete checkout first.' },
      { status: 403 }
    );
  }

  const order = orders[0];

  // Idempotency: already approved
  const existing = await getApprovalForLead(lead.id);
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyApproved: true,
      approvedAt: existing.approved_at,
      orderStatus: 'approved',
    });
  }

  // Extract IP for audit (not logged, only stored)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  // Record approval
  const approval = await recordApproval({
    leadId: lead.id,
    orderId: order.id,
    approverEmail: session.email,
    checkboxCopy: APPROVAL_CHECKBOX_COPY, // exact copy stored for audit
    ipAddress,
  });

  if (!approval) {
    return NextResponse.json({ error: 'Could not record approval. Please try again.' }, { status: 500 });
  }

  // Update order_status to 'approved'
  await updateLeadOrderStatus(lead.id, 'approved');
  try {
    await sql`
      UPDATE orders SET order_status = 'approved', approved_at = now(), updated_at = now()
      WHERE id = ${order.id}
    `;
  } catch (err) {
    console.error('[approve] order status update failed:', err?.message);
  }

  // Record status transition
  await recordStatusTransition({
    leadId: lead.id,
    orderId: order.id,
    fromStatus: 'paid',
    toStatus: 'approved',
    actor: session.email,
  });

  // Notify owner
  notifyOwnerApproval({
    leadId: lead.id,
    email: session.email,
    orderId: order.id,
  }).catch(() => {});

  console.info('[approve] approved', { leadId: lead.id, orderId: order.id });

  return NextResponse.json({
    ok: true,
    approvedAt: approval.approved_at,
    orderStatus: 'approved',
  });
}
