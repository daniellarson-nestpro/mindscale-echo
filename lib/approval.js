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
