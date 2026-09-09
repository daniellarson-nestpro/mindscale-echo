import { STEPS, BRAND } from '../../lib/content';

/**
 * Compressed to a single inline row. A tall four-step ladder frames the
 * purchase as a project; an impulse purchase has to feel like one action.
 */
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-16 md:py-20">
      <div className="page-shell">
        <h2 className="max-w-3xl text-[1.9rem] leading-tight sm:text-[2.5rem]">
          Send it. We write it. You approve.{' '}
          <span className="text-gradient-mint">It goes out.</span>
        </h2>

        <ol className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="border-t border-white/[0.08] pt-4">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-echo-mint">
                {step.n}
              </span>
              <h3 className="mt-2 text-[1.15rem]">{step.title}</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-white/45">{step.copy}</p>
            </li>
          ))}
        </ol>

        <p className="mt-9 text-[0.85rem] text-white/38">{BRAND.urgency}</p>
      </div>
    </section>
  );
}
