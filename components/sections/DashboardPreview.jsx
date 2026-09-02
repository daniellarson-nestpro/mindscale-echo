import { DASHBOARD_STATS } from '../../lib/content';
import { Check, Chart } from '../Icons';

export default function DashboardPreview() {
  return (
    <section id="dashboard" className="section-pad relative">
      <div className="page-shell">
        <header className="reveal max-w-2xl">
          <span className="eyebrow eyebrow-dot">Your dashboard</span>
          <h2 className="mt-6 text-[2.5rem] sm:text-[3.4rem]">
            Proof you can <span className="text-gradient-mint">actually use</span>.
          </h2>
          <p className="mt-5 text-[1rem] leading-relaxed text-white/55">
            Every release comes with a live workspace — status, placement links, badge assets, and
            reporting your team can hand to sales the same week.
          </p>
        </header>

        <div className="reveal mt-14">
          <div className="bezel">
            <div className="bezel-core overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-white/12" />
                  <span className="h-2 w-2 rounded-full bg-white/12" />
                  <span className="h-2 w-2 rounded-full bg-white/12" />
                  <span className="ml-3 font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                    echo / releases / q3-expansion
                  </span>
                </div>
                <span className="hidden font-mono text-[10px] uppercase tracking-eyebrow text-white/30 sm:block">
                  Example release
                </span>
              </div>

              <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3">
                {DASHBOARD_STATS.map((s) => (
                  <div key={s.label} className="bg-ink-900 px-5 py-6 sm:px-7">
                    <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/32">
                      {s.label}
                    </p>
                    <p className="mt-3 font-display text-[2.4rem] leading-none text-white">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                    Live placement links
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {[
                      ['Business Insider', 'Markets · syndicated'],
                      ['Yahoo! Finance', 'Company news'],
                      ['Benzinga', 'Local business'],
                      ['Apple News', 'Aggregated feed'],
                    ].map(([outlet, kind]) => (
                      <li
                        key={outlet}
                        className="flex items-center justify-between rounded-2xl px-4 py-3"
                        style={{
                          background: 'rgba(255,255,255,0.024)',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                        }}
                      >
                        <span className="text-[0.86rem] text-white/72">{outlet}</span>
                        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/30">
                          {kind}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-5">
                  <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                    Release status
                  </p>
                  <ul className="mt-4 space-y-3.5">
                    {[
                      ['Draft written', true],
                      ['Client approved', true],
                      ['Wire distribution', true],
                      ['AI visibility report', false],
                    ].map(([label, done]) => (
                      <li key={label} className="flex items-center gap-3">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            background: done
                              ? 'rgba(127,240,192,0.14)'
                              : 'rgba(255,255,255,0.045)',
                            boxShadow: `inset 0 0 0 1px ${
                              done ? 'rgba(127,240,192,0.32)' : 'rgba(255,255,255,0.09)'
                            }`,
                            color: done ? '#7ff0c0' : 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {done ? <Check width={11} height={11} /> : null}
                        </span>
                        <span
                          className={`text-[0.86rem] ${done ? 'text-white/72' : 'text-white/35'}`}
                        >
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div
                    className="mt-6 rounded-2xl p-4"
                    style={{
                      background:
                        'linear-gradient(140deg, rgba(127,240,192,0.1), rgba(109,92,246,0.09))',
                      boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.2)',
                    }}
                  >
                    <div className="flex items-center gap-2 text-echo-mint">
                      <Chart width={13} height={13} />
                      <span className="font-mono text-[10px] uppercase tracking-eyebrow">
                        Badge kit ready
                      </span>
                    </div>
                    <p className="mt-2 text-[0.8rem] leading-relaxed text-white/50">
                      “As seen in” assets exported for web, deck, and social.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
