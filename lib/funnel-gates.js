/**
 * Server-side routing decisions for the checkout and preview pages.
 * Pure functions, no Next.js imports, so tests can exercise them directly.
 *
 * The rule throughout: only a saved compose draft earns a preview or a
 * checkout. A lead that has filled in fields but has nothing written yet
 * belongs on the brief.
 */

import { previewApprovePath } from './approval.js';

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Soft copy when checkout is refused because nothing has been written yet. */
export const DRAFT_REQUIRED_MESSAGE =
  'Finish your brief first. We write the release, you read it, then you send it out.';

/**
 * Where /checkout should send the visitor instead of rendering, or null to
 * render. Anonymous visitors (the marketing demo) are untouched: there is no
 * lead to protect. A resolved lead with no draft is sent back to the brief,
 * and one with an unapproved draft to the approval step.
 */
export function checkoutGateFor({ lead, hasRealDraft, alreadyApproved, token }) {
  if (!lead) return null;
  if (!hasRealDraft) return '/brief';
  if (!alreadyApproved) return previewApprovePath(lead.id || token);
  return null;
}

/** Where a bare /preview goes. */
export function previewIndexPathFor({ sessionEmail, lead, hasRealDraft }) {
  if (!sessionEmail) return '/preview/demo';
  if (lead?.id && hasRealDraft) return `/preview/${lead.id}`;
  return '/brief';
}

/**
 * Where /preview/[token] should redirect, or null to render. A signed-in
 * customer looking at their own lead (by id, or via the demo token, which
 * resolves to their lead) with no draft goes to the brief: the fallback
 * "draft built from the brief" is not a release and must not be sold as one.
 * Share links viewed signed-out and other people's leads render as before.
 */
export function previewPagePathFor({ token, sessionEmail, lead, hasRealDraft }) {
  if (!sessionEmail || !lead) return null;
  if (hasRealDraft) return null;
  const own = lead.email && normalizeEmail(lead.email) === normalizeEmail(sessionEmail);
  if (!own) return null;
  if (token === 'demo' || token === lead.id) return '/brief';
  return null;
}
