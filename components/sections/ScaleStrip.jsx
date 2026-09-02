import { SCALE, MEDIA_BADGES, AI_BADGES, BRAND } from '../../lib/content';
import Odometer from '../Odometer';

export default function ScaleStrip() {
  const track = [...MEDIA_BADGES, ...MEDIA_BADGES];

  return (
    <section id="reach" className="relative overflow-hidden py-16 md:py-20">
      <div className="page-shell">
        <div className="rule" />

        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-6">
          {SCALE.map((s) => (
            <div key={s.label}>
              <p className="font-display leading-[0.86] tracking-[-0.045em] text-white"
                 style={{ fontSize: 'clamp(4.4rem, 13vw, 11rem)' }}>
                <Odometer value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[0.86rem] text-white/45">{BRAND.credibility}</p>
      </div>

      {/* Volume and flow, not a list of twelve things. */}
      <div className="marquee mt-12" aria-hidden="true">
        <div className="marquee-track">
          {track.map((name, i) => (
            <span key={`${name}-${i}`} className="marquee-item">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="page-shell mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-echo-violet">
            AI indexing layer — Premium
          </p>
          <ul className="flex flex-wrap gap-2">
            {AI_BADGES.map((name) => (
              <li key={name}>
                <span className="logo-pill logo-pill-ai">{name}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase leading-relaxed tracking-eyebrow text-white/25">
          Distribution network — eligible placements vary by package, newsworthiness, and
          editorial discretion
        </p>
      </div>
    </section>
  );
}
