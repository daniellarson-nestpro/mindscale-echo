'use client';

/**
 * Customer-facing order status ladder.
 * Statuses: draft → writing → ready → paid → approved → pr_sent → (failed | refunded)
 */

const STEPS = [
  { key: 'draft', label: 'Brief submitted', desc: 'Your information has been received.' },
  { key: 'writing', label: 'Writing in progress', desc: 'Your press release is being composed.' },
  { key: 'ready', label: 'Ready to read', desc: 'Your draft is ready for review.' },
  { key: 'paid', label: 'Payment confirmed', desc: 'Payment received. Review your press release above.' },
  { key: 'approved', label: 'Approved', desc: 'You approved the release. Awaiting manual vendor submission.' },
  { key: 'pr_sent', label: 'PR sent', desc: 'Your press release has been submitted to the vendor.' },
];

const STATUS_RANK = {};
STEPS.forEach((s, i) => { STATUS_RANK[s.key] = i; });

const TERMINAL_STATUSES = {
  failed: { label: 'Writing failed', desc: 'There was a problem composing your release. Please contact support.', color: 'amber' },
  refunded: {
    label: 'Refunded',
    desc: 'Your order has been refunded.',
    color: 'amber',
    disclaimer:
      'Note: refunds are not available after your press release has been submitted to the vendor. If you have questions, please contact support.',
  },
};

export default function StatusLadder({ orderStatus }) {
  const status = orderStatus || 'draft';

  if (TERMINAL_STATUSES[status]) {
    const t = TERMINAL_STATUSES[status];
    return (
      <div
        className="rounded-[1.5rem] p-5"
        style={{ background: 'rgba(251,191,36,0.06)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.18)' }}
      >
        <p className="text-[0.9rem] font-medium text-amber-200/90">{t.label}</p>
        <p className="mt-1 text-[0.82rem] text-white/55">{t.desc}</p>
        {t.disclaimer && (
          <p className="mt-2 text-[0.78rem] text-amber-200/60">{t.disclaimer}</p>
        )}
      </div>
    );
  }

  const currentRank = STATUS_RANK[status] ?? 0;

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i < currentRank;
        const active = i === currentRank;
        const future = i > currentRank;

        return (
          <li key={step.key} className="flex items-start gap-4">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: done
                    ? 'rgba(127,240,192,0.18)'
                    : active
                    ? 'rgba(127,240,192,0.10)'
                    : 'rgba(255,255,255,0.05)',
                  boxShadow: done
                    ? 'inset 0 0 0 1px rgba(127,240,192,0.5)'
                    : active
                    ? 'inset 0 0 0 1.5px rgba(127,240,192,0.7)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                  color: done ? '#7ff0c0' : active ? '#7ff0c0' : 'rgba(255,255,255,0.25)',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-[1px] flex-1 my-1"
                  style={{
                    background: done ? 'rgba(127,240,192,0.3)' : 'rgba(255,255,255,0.07)',
                    minHeight: '1.25rem',
                  }}
                />
              )}
            </div>

            <div className="pb-4 pt-0.5">
              <p
                className="text-[0.88rem] font-medium"
                style={{ color: active ? '#7ff0c0' : done ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)' }}
              >
                {step.label}
                {active && <span className="ml-2 font-mono text-[10px] uppercase tracking-eyebrow opacity-60">Current</span>}
              </p>
              {(active || done) && (
                <p className="mt-0.5 text-[0.78rem] leading-relaxed text-white/35">{step.desc}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
