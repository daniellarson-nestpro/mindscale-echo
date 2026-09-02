import { BRAND, HERO_PROOF } from '../../lib/content';
import { ArrowUpRight, ArrowDown, Broadcast, Spark, Document } from '../Icons';

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-32 sm:pt-40 lg:pb-28 lg:pt-48">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[38rem] w-[70rem] -translate-x-1/2 opacity-70"
        style={{
          background:
            'radial-gradient(48% 50% at 50% 0%, rgba(127,240,192,0.16), transparent 70%)',
        }}
      />

      <div className="page-shell relative">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* ---- Editorial split: left ---- */}
          <div className="reveal lg:col-span-6 xl:col-span-6">
            <span className="eyebrow eyebrow-dot">Media distribution · Human + AI</span>

            <h1 className="mt-7 text-[3.4rem] leading-[0.92] sm:text-[4.6rem] lg:text-[5.1rem]">
              <span className="text-gradient">Mindscale</span>
              <br />
              <span className="text-gradient-mint">Echo</span>
            </h1>

            <p className="mt-6 max-w-xl font-display text-[1.35rem] leading-[1.25] text-white/70 sm:text-[1.6rem]">
              {BRAND.subheadline}
            </p>

            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-white/55">
              {BRAND.heroCopy}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#pricing" className="btn btn-primary justify-between sm:justify-start">
                {BRAND.primaryCta}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
              <a href="#how-it-works" className="btn btn-ghost justify-between sm:justify-start">
                {BRAND.secondaryCta}
                <span className="btn-nib">
                  <ArrowDown />
                </span>
              </a>
            </div>

            <div className="mt-10 flex items-start gap-3">
              <span className="mt-[0.35rem] h-8 w-px shrink-0 bg-gradient-to-b from-echo-mint/70 to-transparent" />
              <p className="max-w-md font-display text-[1.05rem] leading-snug text-white/75">
                “{BRAND.hook}”
              </p>
            </div>
          </div>

          {/* ---- Editorial split: right (signal visual) ---- */}
          <div className="reveal lg:col-span-6" style={{ '--reveal-delay': '140ms' }}>
            <SignalCard />
          </div>
        </div>

        {/* ---- Proof rail ---- */}
        <div className="reveal mt-16 lg:mt-24" style={{ '--reveal-delay': '220ms' }}>
          <div className="rule" />
          <ul className="grid gap-x-8 gap-y-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
            {HERO_PROOF.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-[0.42rem] h-1 w-1 shrink-0 rounded-full bg-echo-mint" />
                <span className="text-[0.83rem] leading-snug text-white/50">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SignalCard() {
  return (
    <div className="bezel bezel-lift">
      <div className="bezel-core relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(109,92,246,0.34), transparent 68%)',
          }}
        />

        <div className="relative flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
            Release signal path
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-eyebrow text-echo-mint">
            <span className="h-1 w-1 rounded-full bg-echo-mint" /> Live
          </span>
        </div>

        {/* Input */}
        <div className="relative mt-6 rounded-2xl p-4" style={cell}>
          <div className="flex items-center gap-3">
            <Chip>
              <Document width={14} height={14} />
            </Chip>
            <div>
              <p className="text-[0.88rem] text-white/85">Local article submitted</p>
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/30">
                Input
              </p>
            </div>
          </div>
        </div>

        <Connector />

        {/* Engine */}
        <div className="relative rounded-2xl p-4" style={engineCell}>
          <div className="flex items-center gap-3">
            <Chip accent>
              <Spark width={14} height={14} />
            </Chip>
            <div>
              <p className="font-display text-[1rem] text-white">Mindscale Echo</p>
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                AI-assisted drafting · editorial formatting
              </p>
            </div>
          </div>
        </div>

        <Connector split />

        {/* Two layers */}
        <div className="grid gap-3 sm:grid-cols-2">
          <LayerMini
            icon={<Broadcast width={13} height={13} />}
            label="Human media layer"
            lines={['Wire + news publishers', 'Search-indexed placements', '300+ / 500+ outlets']}
            tone="mint"
          />
          <LayerMini
            icon={<Spark width={13} height={13} />}
            label="AI discovery layer"
            lines={['Answer engines', 'Structured brand signals', 'Premium package']}
            tone="violet"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4">
          {['SEO lift', 'Brand awareness', 'AI visibility', 'Demand'].map((o) => (
            <span
              key={o}
              className="font-mono text-[10px] uppercase tracking-eyebrow text-white/40"
            >
              {o}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const cell = {
  background: 'rgba(255,255,255,0.028)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const engineCell = {
  background:
    'linear-gradient(120deg, rgba(127,240,192,0.14), rgba(109,92,246,0.12) 70%, rgba(255,255,255,0.02))',
  boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22), inset 0 1px 0 rgba(255,255,255,0.16)',
};

function Chip({ children, accent }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
      style={{
        background: accent ? 'rgba(127,240,192,0.16)' : 'rgba(255,255,255,0.06)',
        boxShadow: `inset 0 0 0 1px ${accent ? 'rgba(127,240,192,0.3)' : 'rgba(255,255,255,0.1)'}`,
        color: accent ? '#7ff0c0' : 'rgba(255,255,255,0.75)',
      }}
    >
      {children}
    </span>
  );
}

function Connector({ split }) {
  return (
    <div className="relative flex h-8 items-center justify-center" aria-hidden="true">
      <span
        className="block w-px"
        style={{
          height: '100%',
          background:
            'linear-gradient(180deg, rgba(127,240,192,0.05), rgba(127,240,192,0.5), rgba(127,240,192,0.05))',
        }}
      />
      {split && (
        <span
          className="absolute bottom-0 left-1/2 hidden h-px w-1/2 -translate-x-1/2 sm:block"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          }}
        />
      )}
    </div>
  );
}

function LayerMini({ icon, label, lines, tone }) {
  const ring = tone === 'mint' ? 'rgba(127,240,192,0.24)' : 'rgba(167,139,250,0.26)';
  const text = tone === 'mint' ? '#7ff0c0' : '#c4b5fd';
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.025)',
        boxShadow: `inset 0 0 0 1px ${ring}, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      <div className="flex items-center gap-2" style={{ color: text }}>
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-eyebrow">{label}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {lines.map((l) => (
          <li key={l} className="text-[0.8rem] leading-snug text-white/55">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
