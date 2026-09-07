import { TROPHY } from '../../lib/content';
import { ArrowUpRight } from '../Icons';

/**
 * The object the customer is actually buying: a badge strip on their own site.
 * Rendered light and warm on purpose — it's the one moment of temperature on
 * the page, and it reads as a real website rather than another dark card.
 */
export default function Trophy() {
  return (
    <section id="trophy" className="section-pad relative">
      <div className="page-shell">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <header className="reveal lg:col-span-5">
            <span className="eyebrow eyebrow-dot">{TROPHY.eyebrow}</span>
            <h2 className="mt-6 text-[2.3rem] sm:text-[3rem]">{TROPHY.headline}</h2>
            <p className="mt-5 text-[1rem] leading-relaxed text-white/55">{TROPHY.copy}</p>
            <a href="#pricing" className="btn btn-ghost mt-8">
              Launch My Release
              <span className="btn-nib">
                <ArrowUpRight />
              </span>
            </a>
          </header>

          <div className="reveal lg:col-span-7" style={{ '--reveal-delay': '120ms' }}>
            <div className="bezel">
              <div
                className="rounded-core overflow-hidden"
                style={{
                  background: 'linear-gradient(170deg, #fdfbf6 0%, #f4efe6 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                {/* browser chrome */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(28,25,20,0.08)' }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(28,25,20,0.13)' }} />
                  <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(28,25,20,0.13)' }} />
                  <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(28,25,20,0.13)' }} />
                  <span
                    className="ml-3 rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em]"
                    style={{ background: 'rgba(28,25,20,0.05)', color: 'rgba(28,25,20,0.42)' }}
                  >
                    northlinecoffee.com
                  </span>
                </div>

                <div className="px-7 py-10 sm:px-10 sm:py-12">
                  <p
                    className="font-mono text-[9px] uppercase tracking-[0.22em]"
                    style={{ color: 'rgba(28,25,20,0.4)' }}
                  >
                    Est. 2019 · Grandview
                  </p>
                  <h3
                    className="mt-4 font-display text-[2rem] leading-[0.98] sm:text-[2.6rem]"
                    style={{ color: '#1c1914' }}
                  >
                    {TROPHY.siteName}
                  </h3>
                  <p className="mt-3 text-[0.95rem]" style={{ color: 'rgba(28,25,20,0.55)' }}>
                    {TROPHY.siteTag}
                  </p>

                  <div
                    className="mt-9 pt-7"
                    style={{ borderTop: '1px solid rgba(28,25,20,0.1)' }}
                  >
                    <p
                      className="font-mono text-[9px] uppercase tracking-[0.22em]"
                      style={{ color: 'rgba(28,25,20,0.38)' }}
                    >
                      As seen in
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
                      {TROPHY.badgeLine.map((name) => (
                        <span
                          key={name}
                          className="text-[0.82rem] font-medium uppercase tracking-[0.1em]"
                          style={{ color: 'rgba(28,25,20,0.72)' }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-eyebrow text-white/25">
              {TROPHY.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
