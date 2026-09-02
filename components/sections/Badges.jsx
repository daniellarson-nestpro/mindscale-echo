import { MEDIA_BADGES, AI_BADGES } from '../../lib/content';

export default function Badges() {
  return (
    <section id="as-seen-in" className="relative py-20 md:py-24">
      <div className="page-shell">
        <div className="reveal">
          <div className="rule" />
        </div>

        <div className="reveal mt-12 text-center">
          <span className="eyebrow">As seen in</span>
          <p className="mx-auto mt-5 max-w-2xl font-display text-[1.3rem] leading-tight text-white/70 sm:text-[1.6rem]">
            Distribution may include visibility across major media and discovery channels.
          </p>
        </div>

        <ul className="reveal mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {MEDIA_BADGES.map((name) => (
            <li key={name}>
              <span className="logo-pill w-full">{name}</span>
            </li>
          ))}
        </ul>

        <div className="reveal mt-14" style={{ '--reveal-delay': '120ms' }}>
          <div className="bezel">
            <div className="bezel-core p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-md">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-echo-violet">
                    AI indexing layer
                  </span>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-white/55">
                    On the Premium package, releases are structured for the discovery surfaces
                    people now ask directly. Eligible placements only — no platform guarantees
                    what an answer engine will say.
                  </p>
                </div>
                <ul className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-xl">
                  {AI_BADGES.map((name) => (
                    <li key={name}>
                      <span className="logo-pill logo-pill-ai w-full">{name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <p className="reveal mx-auto mt-8 max-w-3xl text-center text-[0.78rem] leading-relaxed text-white/32">
          Outlet and platform names identify the distribution network and eligible placement
          surfaces. They do not imply endorsement, partnership, or guaranteed pickup. Featured
          placement reporting is provided for every release; specific outlets vary by package,
          newsworthiness, and editorial discretion.
        </p>
      </div>
    </section>
  );
}
