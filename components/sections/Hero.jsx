import { BRAND } from '../../lib/content';
import { PLANS } from '../../lib/plans';
import BroadcastHero from '../BroadcastHero';
import { ArrowUpRight, ArrowDown } from '../Icons';

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-14 pt-28 sm:pt-36 lg:pb-20 lg:pt-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[70rem] -translate-x-1/2 opacity-70"
        style={{
          background:
            'radial-gradient(48% 50% at 50% 0%, rgba(127,240,192,0.15), transparent 70%)',
        }}
      />

      <div className="page-shell relative">
        {/* On mobile the broadcast leads — text-only openings have no pull. */}
        <div className="lg:hidden">
          <BroadcastHero className="mb-2" />
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <span className="eyebrow eyebrow-dot">{BRAND.eyebrow}</span>

            <h1 className="mt-7 text-[3.1rem] leading-[0.94] sm:text-[4.1rem] lg:text-[4.6rem]">
              <span className="text-white/92">{BRAND.headline[0]}</span>
              <br />
              <span className="text-white/92">{BRAND.headline[1]} </span>
              <span className="text-gradient-mint">{BRAND.headlineAccent}</span>
              <span className="text-white/92">.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[1.05rem] leading-relaxed text-white/58">
              {BRAND.subheadline}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#pricing" className="btn btn-primary justify-between sm:justify-start">
                {BRAND.primaryCta} — {PLANS.basic.priceLabel}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
              <a href="#trophy" className="btn btn-ghost justify-between sm:justify-start">
                {BRAND.secondaryCta}
                <span className="btn-nib">
                  <ArrowDown />
                </span>
              </a>
            </div>

            <p className="mt-5 text-[0.82rem] text-white/38">{BRAND.ctaMicro}</p>
          </div>

          <div className="hidden lg:col-span-6 lg:block">
            <BroadcastHero />
          </div>
        </div>
      </div>
    </section>
  );
}
