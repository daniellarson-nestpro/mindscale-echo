/**
 * Approval constants shared between the API route and tests.
 * Keep this file free of Next.js imports so tests can import it directly.
 */

// Canonical checkbox copy text — version 'v1'.
// This exact string is stored in the approvals table for audit purposes.
export const APPROVAL_CHECKBOX_COPY =
  'I have reviewed and approve this press release for submission to the distribution vendor. ' +
  'I understand that once submitted to the vendor, Mindscale Echo may be able to stop the ' +
  'release in limited cases, but cannot issue a refund after vendor submission because ' +
  'fulfillment has already been paid for.';

/**
 * Customer-facing ladder status. An approval row wins over a stale
 * lead.order_status of "paid" so the UI cannot stay on Payment confirmed
 * after a successful POST /api/approve.
 */
export function displayOrderStatus({ orderStatus, alreadyApproved }) {
  if (orderStatus === 'pr_sent' || orderStatus === 'refunded' || orderStatus === 'failed') {
    return orderStatus;
  }
  if (alreadyApproved || orderStatus === 'approved') return 'approved';
  return orderStatus || null;
}
