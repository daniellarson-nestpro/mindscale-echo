/** Honest release pipeline. Only Paid and Brief received are driven by real data. */

export const RELEASE_STEPS = [
  { id: 'paid', label: 'Paid' },
  { id: 'brief_received', label: 'Brief received' },
  { id: 'draft_in_progress', label: 'Draft in progress', placeholder: true },
  { id: 'awaiting_approval', label: 'Awaiting approval', placeholder: true },
  { id: 'distributed', label: 'Distributed', placeholder: true },
];

export function isPaid(order) {
  return order?.payment_status === 'paid';
}

export function hasBrief(order) {
  return Boolean(order?.brief_submitted_at);
}

export function currentStepId(order) {
  if (hasBrief(order) && isPaid(order)) return 'brief_received';
  if (isPaid(order)) return 'paid';
  return null;
}

export function stepState(order, stepId) {
  const current = currentStepId(order);
  const currentIndex = RELEASE_STEPS.findIndex((s) => s.id === current);
  const stepIndex = RELEASE_STEPS.findIndex((s) => s.id === stepId);
  if (currentIndex === -1 || stepIndex === -1) return 'upcoming';
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'current';
  return 'upcoming';
}

export function formatAmount(cents, currency = 'usd') {
  const amount = typeof cents === 'number' ? cents : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
