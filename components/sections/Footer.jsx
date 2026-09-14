import { ArrowUpRight } from '../Icons';
import { BRAND, FINAL_CTA, START_HREF } from '../../lib/content';
import FooterBar from '../FooterBar';

export default function Footer() {
  return (
    <footer className="relative pb-14 pt-10">
      <div className="page-shell">
        <div className="reveal">
          <div className="bezel">
            <div className="bezel-core px-7 py-12 text-center sm:px-10 sm:py-16">
              <span className="eyebrow eyebrow-dot">{FINAL_CTA.eyebrow}</span>
              <h2 className="mx-auto mt-6 max-w-3xl text-[2.3rem] leading-[0.98] sm:text-[3.4rem]">
                <span className="text-white/92">{FINAL_CTA.headline[0]} </span>
                <span className="text-gradient-mint">{FINAL_CTA.headline[1]}</span>
                <span className="text-white/92">.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-white/52">
                {FINAL_CTA.subhead}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href={START_HREF} className="btn btn-primary">
                  {FINAL_CTA.button}
                  <span className="btn-nib">
                    <ArrowUpRight />
                  </span>
                </a>
              </div>
              <p className="mt-5 text-[0.8rem] text-white/32">{BRAND.trustLine}</p>
            </div>
          </div>
        </div>

        <FooterBar />
      </div>
    </footer>
  );
}
