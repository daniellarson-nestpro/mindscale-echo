import { ArrowUpRight } from '../Icons';
import { BRAND } from '../../lib/content';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative pb-14 pt-8">
      <div className="page-shell">
        <div className="reveal">
          <div className="bezel">
            <div className="bezel-core px-7 py-12 text-center sm:px-10 sm:py-16">
              <span className="eyebrow eyebrow-dot">Ready when you are</span>
              <h2 className="mx-auto mt-6 max-w-3xl text-[2.3rem] leading-[0.98] sm:text-[3.4rem]">
                <span className="text-gradient">You already earned the story.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[1rem] leading-relaxed text-white/52">
                {BRAND.hook}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href="#pricing" className="btn btn-primary">
                  {BRAND.primaryCta}
                  <span className="btn-nib">
                    <ArrowUpRight />
                  </span>
                </a>
                <a href="#how-it-works" className="btn btn-ghost">
                  {BRAND.secondaryCta}
                  <span className="btn-nib">
                    <ArrowUpRight />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/[0.07] pt-8 sm:flex-row">
          <p className="font-display text-[0.95rem] text-white/60">
            Mindscale <span className="text-white/35">Echo</span>
            <span className="ml-3 font-sans text-[0.78rem] text-white/28">
              A {BRAND.parent} product
            </span>
          </p>
          <p className="text-center text-[0.74rem] leading-relaxed text-white/28 sm:text-right">
            © {year} {BRAND.parent}. Distribution network and eligible placements vary by package,
            newsworthiness, and editorial discretion. Outlet names do not imply endorsement.
          </p>
        </div>
      </div>
    </footer>
  );
}
