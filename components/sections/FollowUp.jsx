import { ArrowUpRight, Shield } from '../Icons';

export default function FollowUp() {
  return (
    <section id="follow-up" className="relative pb-8 pt-4">
      <div className="page-shell">
        <div className="reveal">
          <div
            className="bezel"
            style={{
              background:
                'linear-gradient(140deg, rgba(127,240,192,0.2), rgba(109,92,246,0.15) 62%, rgba(255,255,255,0.03))',
            }}
          >
            <div
              className="rounded-core p-8 sm:p-12"
              style={{
                background: 'linear-gradient(150deg, rgba(13,13,17,0.94), rgba(8,8,11,0.97))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
                <div className="lg:col-span-8">
                  <span className="eyebrow">Optional add-on</span>
                  <h2 className="mt-6 max-w-2xl text-[2.2rem] sm:text-[2.9rem]">
                    Want more coverage after distribution?
                  </h2>
                  <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-white/55">
                    Once your release is live, Mindscale Echo can use it as a stronger media asset
                    for regional, industry, or category-specific follow-up pitching.
                  </p>
                </div>
                <div className="lg:col-span-4 lg:justify-self-end">
                  <a
                    href="mailto:hello@mindscalepartners.com?subject=Follow-up%20pitching%20—%20Mindscale%20Echo"
                    className="btn btn-primary w-full justify-between lg:w-max"
                  >
                    Ask About Follow-Up Pitching
                    <span className="btn-nib">
                      <ArrowUpRight />
                    </span>
                  </a>
                  <p className="mt-4 flex items-center gap-2 text-[0.78rem] text-white/35 lg:justify-end">
                    <Shield width={12} height={12} />
                    Scoped per campaign
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
