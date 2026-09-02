import Nav from '../../components/Nav';
import Footer from '../../components/sections/Footer';
import { ArrowUpRight, ArrowRight } from '../../components/Icons';
import { PLANS } from '../../lib/plans';

export const metadata = {
  title: 'Checkout cancelled | Mindscale Echo',
  robots: { index: false, follow: false },
};

export default function CancelPage() {
  return (
    <>
      <Nav />
      <main className="pb-10 pt-32 sm:pt-40">
        <div className="page-shell">
          <div className="mx-auto max-w-2xl">
            <div className="bezel">
              <div className="bezel-core p-8 text-center sm:p-14">
                <span className="eyebrow">Checkout cancelled</span>
                <h1 className="mt-7 text-[2.4rem] leading-[1] sm:text-[3.1rem]">
                  <span className="text-gradient">No charge was made.</span>
                </h1>
                <p className="mx-auto mt-5 max-w-md text-[1rem] leading-relaxed text-white/55">
                  Your card was not charged and nothing has been distributed. Pick a package
                  whenever you’re ready — your story keeps.
                </p>

                <div className="mt-9 grid gap-3 sm:grid-cols-2">
                  {[PLANS.basic, PLANS.premium].map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-2xl p-5 text-left"
                      style={{
                        background: 'rgba(255,255,255,0.024)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                      }}
                    >
                      <p className="font-display text-[1.3rem] text-white">{plan.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                        {plan.priceLabel} {plan.cadence}
                      </p>
                      <p className="mt-3 text-[0.82rem] leading-relaxed text-white/45">
                        {plan.tagline}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <a href="/#pricing" className="btn btn-primary">
                    Return to pricing
                    <span className="btn-nib">
                      <ArrowRight />
                    </span>
                  </a>
                  <a
                    href="mailto:hello@mindscalepartners.com?subject=Question%20about%20Mindscale%20Echo"
                    className="btn btn-ghost"
                  >
                    Ask a question first
                    <span className="btn-nib">
                      <ArrowUpRight />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
