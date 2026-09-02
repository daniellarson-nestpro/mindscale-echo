import { Shield, Spark, Chart } from '../Icons';

const PILLARS = [
  {
    icon: <Spark width={15} height={15} />,
    title: '0-to-1 operator DNA',
    copy: 'Led by a serial entrepreneur who builds high-growth digital platforms from scratch.',
  },
  {
    icon: <Chart width={15} height={15} />,
    title: 'Growth-platform discipline',
    copy: 'Distribution treated as a measurable channel, not a one-off press favour.',
  },
  {
    icon: <Shield width={15} height={15} />,
    title: 'Approval-first process',
    copy: 'Nothing is distributed until you have read and approved the written release.',
  },
];

export default function Trust() {
  return (
    <section id="trust" className="section-pad relative">
      <div className="page-shell">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="reveal lg:col-span-5">
            <span className="eyebrow eyebrow-dot">Who builds this</span>
            <h2 className="mt-6 text-[2.3rem] sm:text-[3rem]">
              Built by <span className="text-gradient">Mindscale Partners</span>.
            </h2>
            <p className="mt-6 text-[1rem] leading-relaxed text-white/58">
              A TechCrunch Disrupt Battlefield finalist, led by a 0-to-1 serial entrepreneur
              specializing in high-growth digital platform growth.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <span className="logo-pill">TechCrunch Disrupt Battlefield Finalist</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-5 sm:grid-cols-3">
              {PILLARS.map((p, i) => (
                <div
                  key={p.title}
                  className="reveal"
                  style={{ '--reveal-delay': `${i * 100}ms` }}
                >
                  <div className="bezel bezel-lift h-full">
                    <div className="bezel-core flex h-full flex-col p-6">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full text-echo-mint"
                        style={{
                          background: 'rgba(127,240,192,0.1)',
                          boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.24)',
                        }}
                      >
                        {p.icon}
                      </span>
                      <h3 className="mt-6 text-[1.15rem] leading-tight">{p.title}</h3>
                      <p className="mt-3 text-[0.85rem] leading-relaxed text-white/48">{p.copy}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
