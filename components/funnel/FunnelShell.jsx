import Link from 'next/link';

/**
 * Funnel chrome: wordmark + step indicator, no navigation. Nav links in a
 * checkout funnel are exits.
 */
export default function FunnelShell({ step, of = 3, width = 'narrow', children }) {
  const max = width === 'wide' ? 'max-w-[880px]' : 'max-w-[640px]';

  return (
    <div className="relative min-h-[100dvh] pb-20 pt-6 sm:pt-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[54rem] -translate-x-1/2 opacity-60"
        style={{
          background: 'radial-gradient(50% 50% at 50% 0%, rgba(127,240,192,0.11), transparent 70%)',
        }}
      />

      <header className={`relative mx-auto flex ${max} items-center justify-between px-5 sm:px-8`}>
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(150deg, rgba(127,240,192,0.9), rgba(109,92,246,0.75))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="2.2" fill="#050506" />
              <path
                d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 17.4a7.6 7.6 0 0 0 0-10.8"
                stroke="#050506"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="font-display text-[0.95rem] tracking-[-0.02em] text-white">
            Mindscale <span className="text-white/45">Echo</span>
          </span>
        </Link>

        {step ? (
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/32">
            {String(step).padStart(2, '0')} / {String(of).padStart(2, '0')}
          </span>
        ) : null}
      </header>

      <main className={`relative mx-auto ${max} px-5 pt-12 sm:px-8 sm:pt-16`}>{children}</main>

      <footer className={`relative mx-auto ${max} px-5 pt-16 sm:px-8`}>
        <div className="rule" />
        <p className="mt-6 text-[0.72rem] leading-relaxed text-white/28">
          Distribution network and eligible placements vary by package, newsworthiness, and
          editorial discretion. Outlet and platform names identify the distribution network and do
          not imply endorsement or guaranteed pickup.
        </p>
      </footer>
    </div>
  );
}
