import { PLANS } from '../../lib/plans';
import { PRICING, START_HREF } from '../../lib/content';
import { Check, Lock, ArrowUpRight } from '../Icons';

/**
 * Both cards link to /start. Nothing on the homepage opens Stripe: the
 * customer reads and approves the draft first, then pays on /checkout.
 */
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
          <span className="eyebrow eyebrow-dot">{PRICING.eyebrow}</span>
          <h2 className="mt-6 text-[2.5rem] sm:text-[3.4rem]">
            {PRICING.headline[0]}{' '}
            <span className="text-gradient-mint">{PRICING.headline[1]}</span>
          </h2>
        </header>

        <div className="mt-14 grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mx-auto mt-10 flex max-w-3xl items-start justify-center gap-2 text-center text-[0.82rem] leading-relaxed text-white/40">
          <Lock width={13} height={13} className="mt-1 shrink-0" />
          <span>{PRICING.underCards}</span>
        </p>

        <div className="reveal mx-auto mt-10 max-w-3xl">
          <div className="bezel">
            <div className="bezel-core p-6 sm:p-8">
              <span className="eyebrow eyebrow-dot">Guarantee</span>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-white/80">
                {PRICING.guarantee}
              </p>
              <p className="mt-3 text-[0.86rem] leading-relaxed text-white/45">{PRICING.timing}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }) {
  const featured = plan.featured;

  return (
    <div className={`h-full ${featured ? 'lg:-mt-3 lg:scale-[1.035]' : ''}`}>
      <div
        className="bezel plan-card h-full"
        style={
          featured
            ? {
                background:
                  'linear-gradient(150deg, rgba(127,240,192,0.24), rgba(109,92,246,0.18) 60%, rgba(255,255,255,0.03))',
                boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.3), var(--ambient)',
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
            {plan.badge && <span className="eyebrow shrink-0">{plan.badge}</span>}
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

          {plan.delta && (
            <p
              className="mt-5 rounded-2xl px-4 py-3 text-[0.86rem] leading-snug text-white/78"
              style={{
                background: 'rgba(127,240,192,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22)',
              }}
            >
              {plan.delta}
            </p>
          )}

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

          <a
            href={START_HREF}
            className={`btn mt-9 w-full justify-between ${featured ? 'btn-primary' : 'btn-ghost'}`}
          >
            {plan.cta}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
