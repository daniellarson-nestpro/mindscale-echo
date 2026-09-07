export const FURTHEST_STEPS = ['brief', 'preview', 'checkout', 'account'];

const RANK = { brief: 0, preview: 1, checkout: 2, account: 3 };

export function isFurthestStep(value) {
  return FURTHEST_STEPS.includes(value);
}

export function maxStep(a, b) {
  const left = isFurthestStep(a) ? a : 'brief';
  const right = isFurthestStep(b) ? b : 'brief';
  return RANK[left] >= RANK[right] ? left : right;
}

export function pathForStep(step) {
  switch (step) {
    case 'preview':
      return '/preview';
    case 'checkout':
      return '/checkout';
    case 'account':
      return '/account';
    default:
      return '/brief';
  }
}

export function hasComposeDraft(lead) {
  const raw = lead?.compose_json;
  if (!raw) return false;
  if (typeof raw === 'object') return raw.ok === true && raw.source === 'n8n';
  if (typeof raw !== 'string') return false;
  return /"source"\s*:\s*"n8n"/.test(raw);
}

/**
 * Where a lead belongs, inferred from what actually exists.
 *
 * Only a real draft advances past the brief. Filled-in fields are not progress:
 * /start collects company name, announcement type and article text *before* the
 * email gate, so inferring 'checkout' from that trio sent every new customer
 * straight from email verification to a payment page — skipping the brief and
 * the compose entirely, and asking them to pay for a release nobody had
 * written. Likewise 'preview' is meaningless with nothing to preview.
 *
 * Checkout is reached from the preview screen, not by inference. Nothing writes
 * furthest_step: 'checkout', so there is no stored progress to honour here.
 */
export function inferStepFromLead(lead) {
  if (!lead) return 'brief';
  if (hasComposeDraft(lead)) return 'preview';
  return 'brief';
}

export function hasPaidOrder(orders) {
  return Boolean(orders?.some((order) => order.payment_status === 'paid'));
}

export function resolveFurthestStep(lead, orders = []) {
  if (hasPaidOrder(orders)) return 'account';
  const stored = isFurthestStep(lead?.furthest_step) ? lead.furthest_step : 'brief';
  return maxStep(stored, inferStepFromLead(lead));
}

/** Any sign the customer has started, short of an actual draft. */
function hasBriefProgress(lead) {
  if (!lead) return false;
  return Boolean(
    lead.company_name ||
      lead.website ||
      lead.announcement_type ||
      lead.article_url ||
      lead.article_text ||
      lead.quote ||
      lead.notes ||
      lead.contact_name ||
      lead.phone ||
      lead.verified_at
  );
}

/**
 * Only compose_json makes a draft ready. This used to also report
 * 'draft_ready_unpurchased' whenever the brief fields looked complete, so
 * /account told customers their release was written before anything had been.
 */
export function ladderState(lead, orders = []) {
  if (hasPaidOrder(orders)) return 'purchased';
  if (hasComposeDraft(lead)) return 'draft_ready_unpurchased';
  if (hasBriefProgress(lead)) return 'in_progress';
  return 'empty';
}

export function redirectToFor(lead, orders = [], nextPath) {
  const step = resolveFurthestStep(lead, orders);
  if (typeof nextPath === 'string' && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    return nextPath;
  }
  return pathForStep(step);
}
