import { FAQ } from '../../lib/content';

export default function Faq() {
  return (
    <section id="faq" className="section-pad relative">
      <div className="page-shell">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <header className="reveal lg:col-span-4">
            <span className="eyebrow eyebrow-dot">FAQ</span>
            <h2 className="mt-6 text-[2.3rem] sm:text-[3rem]">
              Straight <span className="text-gradient-mint">answers</span>.
            </h2>
            <p className="mt-5 text-[0.96rem] leading-relaxed text-white/52">
              Including the ones about what we can’t promise.
            </p>
          </header>

          <div className="reveal lg:col-span-8">
            <div className="bezel">
              <div className="bezel-core px-2 py-1 sm:px-4 sm:py-2">
                {FAQ.map((item, i) => (
                  <details
                    key={item.q}
                    className="group border-b border-white/[0.06] last:border-b-0"
                    open={i === 0}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-3 py-5 sm:px-4 sm:py-6">
                      <h3 className="max-w-2xl text-[1.02rem] font-medium leading-snug text-white/85 transition-colors duration-500 ease-haptic group-hover:text-white sm:text-[1.12rem]">
                        {item.q}
                      </h3>
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 transition-transform duration-700 ease-haptic group-open:rotate-45"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </summary>
                    <div className="px-3 pb-6 pr-14 sm:px-4">
                      <p className="max-w-2xl text-[0.92rem] leading-relaxed text-white/52">
                        {item.a}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
