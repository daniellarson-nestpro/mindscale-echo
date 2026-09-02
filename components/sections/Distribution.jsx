import { DIAGRAM } from '../../lib/content';
import { ArrowDown, Broadcast, Spark, Document, Chart } from '../Icons';

export default function Distribution() {
  const [human, ai] = DIAGRAM.layers;

  return (
    <section id="distribution" className="section-pad relative">
      <div className="page-shell">
        <header className="reveal max-w-2xl">
          <span className="eyebrow eyebrow-dot">Two-layer distribution</span>
          <h2 className="mt-6 text-[2.5rem] sm:text-[3.4rem]">
            One story, routed to <span className="text-gradient-mint">both audiences</span>.
          </h2>
          <p className="mt-5 text-[1rem] leading-relaxed text-white/55">
            People still discover brands through publishers. Increasingly, machines do the
            discovering first. Mindscale Echo formats a single announcement for both paths at once.
          </p>
        </header>

        <div className="mt-14 lg:mt-20">
          {/* Input */}
          <div className="reveal mx-auto max-w-2xl">
            <div className="bezel">
              <div className="bezel-core flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:p-7">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/75"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                  }}
                >
                  <Document width={17} height={17} />
                </span>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                    {DIAGRAM.input.label}
                  </span>
                  <h3 className="mt-1 text-[1.25rem] sm:text-[1.4rem]">{DIAGRAM.input.title}</h3>
                  <p className="mt-2 text-[0.88rem] leading-relaxed text-white/50">
                    {DIAGRAM.input.detail}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Flow />

          {/* Engine */}
          <div className="reveal mx-auto max-w-xl">
            <div className="bezel bezel-accent">
              <div
                className="rounded-core p-6 text-center sm:p-7"
                style={{
                  background:
                    'linear-gradient(150deg, rgba(14,14,18,0.92), rgba(9,9,12,0.96))',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-echo-mint"
                  style={{
                    background: 'rgba(127,240,192,0.14)',
                    boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.3)',
                  }}
                >
                  <Spark width={17} height={17} />
                </span>
                <span className="mt-4 block font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                  {DIAGRAM.core.label}
                </span>
                <h3 className="mt-2 text-[1.9rem] sm:text-[2.2rem]">
                  <span className="text-gradient">{DIAGRAM.core.title}</span>
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-[0.88rem] leading-relaxed text-white/50">
                  {DIAGRAM.core.detail}
                </p>
              </div>
            </div>
          </div>

          <Fork />

          {/* Two paths */}
          <div className="grid gap-5 lg:grid-cols-2">
            <PathCard layer={human} icon={<Broadcast width={17} height={17} />} />
            <PathCard layer={ai} icon={<Spark width={17} height={17} />} delay="120ms" />
          </div>

          <Flow />

          {/* Outputs */}
          <div className="reveal">
            <div className="bezel">
              <div className="bezel-core p-6 sm:p-8">
                <div className="flex items-center gap-2.5 text-white/45">
                  <Chart width={14} height={14} />
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow">
                    Output — what compounds
                  </span>
                </div>
                <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
                  {DIAGRAM.outputs.map((o) => (
                    <div key={o.title}>
                      <h4 className="text-[1.02rem] leading-tight">{o.title}</h4>
                      <p className="mt-2 text-[0.82rem] leading-relaxed text-white/45">
                        {o.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PathCard({ layer, icon, delay }) {
  const mint = layer.accent === 'mint';
  const ring = mint ? 'rgba(127,240,192,0.26)' : 'rgba(167,139,250,0.28)';
  const tint = mint ? '#7ff0c0' : '#c4b5fd';

  return (
    <div className="reveal" style={delay ? { '--reveal-delay': delay } : undefined}>
      <div
        className="bezel bezel-lift h-full"
        style={{ boxShadow: `inset 0 0 0 1px ${ring}, var(--ambient)` }}
      >
        <div className="bezel-core flex h-full flex-col p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{
                background: mint ? 'rgba(127,240,192,0.12)' : 'rgba(167,139,250,0.12)',
                boxShadow: `inset 0 0 0 1px ${ring}`,
                color: tint,
              }}
            >
              {icon}
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-eyebrow"
              style={{ color: tint }}
            >
              {layer.label}
            </span>
          </div>

          <h3 className="mt-6 text-[1.7rem] sm:text-[2rem]">{layer.title}</h3>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
            {layer.note}
          </p>

          <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {layer.destinations.map((d) => (
              <li key={d} className="flex items-start gap-2.5">
                <span
                  className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full"
                  style={{ background: tint }}
                />
                <span className="text-[0.86rem] leading-snug text-white/60">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Flow() {
  return (
    <div
      className="relative flex h-14 items-center justify-center text-white/25"
      aria-hidden="true"
    >
      <span
        className="block w-px"
        style={{
          height: '100%',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(127,240,192,0.4), rgba(255,255,255,0.04))',
        }}
      />
      <ArrowDown className="absolute" width={14} height={14} />
    </div>
  );
}

function Fork() {
  return (
    <div className="relative h-16" aria-hidden="true">
      <span
        className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2"
        style={{
          background: 'linear-gradient(180deg, rgba(127,240,192,0.4), rgba(255,255,255,0.12))',
        }}
      />
      <span
        className="absolute left-1/4 top-8 hidden h-px w-1/2 lg:block"
        style={{
          background:
            'linear-gradient(90deg, rgba(127,240,192,0.35), rgba(255,255,255,0.14), rgba(167,139,250,0.35))',
        }}
      />
      <span
        className="absolute left-1/4 top-8 hidden h-8 w-px lg:block"
        style={{
          background: 'linear-gradient(180deg, rgba(127,240,192,0.35), rgba(127,240,192,0.08))',
        }}
      />
      <span
        className="absolute left-3/4 top-8 hidden h-8 w-px lg:block"
        style={{
          background: 'linear-gradient(180deg, rgba(167,139,250,0.35), rgba(167,139,250,0.08))',
        }}
      />
      <span
        className="absolute left-1/2 top-8 h-8 w-px -translate-x-1/2 lg:hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
        }}
      />
    </div>
  );
}
