import { PLANS } from '../../lib/plans';
import CheckoutButton from '../CheckoutButton';
import { Check, Lock } from '../Icons';

export default function Pricing() {
  const plans = [PLANS.basic, PLANS.premium];

  return (
    <section id="pricing" className="section-pad relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 h-[30rem] w-[60rem] -translate-x-1/2 opacity-60"
        style={{
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(109,92,246,0.13), transparent 70%)',
        }}
      />

      <div className="page-shell relative">
        <header className="reveal mx-auto max-w-2xl text-center">
          <span className="eyebrow eyebrow-dot">Packages</span>
          <h2 className="mt-6 text-[2.5rem] sm:text-[3.4rem]">
            Pay per release. <span className="text-gradient-mint">No retainer.</span>
          </h2>
          <p className="mt-5 text-[1rem] leading-relaxed text-white/55">
            Choose your distribution depth. You approve the written release before it is sent.
          </p>
        </header>

        <div className="mt-14 grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
          {plans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} delay={i * 110} />
          ))}
        </div>

        <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-white/38">
          <span className="flex items-center gap-2 text-[0.8rem]">
            <Lock width={13} height={13} /> Secure checkout by Stripe
          </span>
          <span className="text-[0.8rem]">Approval required before distribution</span>
          <span className="text-[0.8rem]">Placement reporting included</span>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan, delay }) {
  const featured = plan.featured;

  return (
    <div className="reveal h-full" style={{ '--reveal-delay': `${delay}ms` }}>
      <div
        className="bezel bezel-lift h-full"
        style={
          featured
            ? {
                background:
                  'linear-gradient(150deg, rgba(127,240,192,0.2), rgba(109,92,246,0.16) 60%, rgba(255,255,255,0.03))',
                boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.24), var(--ambient)',
              }
            : undefined
        }
      >
        <div className="bezel-core flex h-full flex-col p-7 sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[1.9rem] sm:text-[2.1rem]">{plan.name}</h3>
              <p className="mt-2 max-w-xs text-[0.88rem] leading-relaxed text-white/50">
                {plan.tagline}
              </p>
            </div>
            {featured && (
              <span className="eyebrow shrink-0">AI layer</span>
            )}
          </div>

          <div className="mt-7 flex items-baseline gap-2">
            <span
              className={`font-display text-[3.2rem] leading-none ${
                featured ? 'text-gradient-mint' : 'text-white'
              }`}
            >
              {plan.priceLabel}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
              {plan.cadence}
            </span>
          </div>

          <div className="mt-7 rule" />

          <ul className="mt-7 flex-1 space-y-3.5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span
                  className="mt-[0.15rem] flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: featured ? 'rgba(127,240,192,0.14)' : 'rgba(255,255,255,0.06)',
                    boxShadow: `inset 0 0 0 1px ${
                      featured ? 'rgba(127,240,192,0.3)' : 'rgba(255,255,255,0.1)'
                    }`,
                    color: featured ? '#7ff0c0' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <Check width={11} height={11} />
                </span>
                <span className="text-[0.9rem] leading-relaxed text-white/62">{f}</span>
              </li>
            ))}
          </ul>

          <CheckoutButton
            plan={plan.id}
            label={plan.cta}
            variant={featured ? 'primary' : 'ghost'}
            className="mt-9"
          />

          <p className="mt-4 text-center text-[0.74rem] text-white/32">
            One-time payment · {plan.name === 'Premium' ? '500+' : '300+'} outlet distribution
            network · Reported placements vary
          </p>
        </div>
      </div>
    </div>
  );
}
