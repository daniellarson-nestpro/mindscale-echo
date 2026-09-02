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

export function inferStepFromLead(lead) {
  if (!lead) return 'brief';
  const hasCore = Boolean(lead.company_name && lead.announcement_type);
  const hasStory = Boolean(lead.article_url || lead.article_text);
  if (hasCore && hasStory) return 'checkout';
  if (
    lead.company_name ||
    lead.website ||
    lead.announcement_type ||
    lead.article_url ||
    lead.article_text ||
    lead.quote ||
    lead.notes
  ) {
    return 'preview';
  }
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

export function ladderState(lead, orders = []) {
  if (hasPaidOrder(orders)) return 'purchased';
  const inferred = inferStepFromLead(lead);
  if (inferred === 'checkout') return 'draft_ready_unpurchased';
  if (inferred === 'preview' || lead?.contact_name || lead?.phone || lead?.verified_at) {
    return 'in_progress';
  }
  return 'empty';
}

export function redirectToFor(lead, orders = [], nextPath) {
  const step = resolveFurthestStep(lead, orders);
  if (typeof nextPath === 'string' && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    return nextPath;
  }
  return pathForStep(step);
}
