import { STEPS } from '../../lib/content';
import { ArrowUpRight } from '../Icons';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-pad relative">
      <div className="page-shell">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <header className="reveal lg:col-span-4">
            <span className="eyebrow eyebrow-dot">How it works</span>
            <h2 className="mt-6 text-[2.5rem] sm:text-[3.2rem]">
              Four steps from <span className="text-gradient-mint">clipping</span> to coverage.
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-white/55">
              Send us your local article. We’ll turn it into a press release and distribute it —
              with your approval before anything goes out.
            </p>
            <a href="#pricing" className="btn btn-ghost mt-8">
              Launch Your Release
              <span className="btn-nib">
                <ArrowUpRight />
              </span>
            </a>
          </header>

          <ol className="lg:col-span-8">
            {STEPS.map((step, i) => (
              <li
                key={step.n}
                className="reveal"
                style={{ '--reveal-delay': `${i * 90}ms` }}
              >
                <div className="group flex items-start gap-5 border-t border-white/[0.07] py-7 transition-colors duration-700 ease-haptic hover:border-white/20 sm:gap-8 sm:py-8">
                  <span
                    className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-[0.75rem] text-white/60 transition-all duration-700 ease-haptic group-hover:text-echo-mint"
                    style={{
                      background: 'rgba(255,255,255,0.035)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
                    }}
                  >
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-[1.45rem] sm:text-[1.7rem]">{step.title}</h3>
                    <p className="mt-2.5 max-w-xl text-[0.94rem] leading-relaxed text-white/52">
                      {step.copy}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
