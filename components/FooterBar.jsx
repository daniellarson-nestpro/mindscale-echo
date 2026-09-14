import Link from 'next/link';
import { BRAND, FOOTER, START_HREF } from '../lib/content';

/**
 * The bottom strip every page shares: wordmark, legal line, Terms/Privacy,
 * and one more "Send the article". Rendered inside a `page-shell`.
 */
export default function FooterBar() {
  return (
    <div className="mt-12 flex flex-col gap-6 border-t border-white/[0.07] pt-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-display text-[0.95rem] text-white/60">
          Mindscale <span className="text-white/35">Echo</span>
          <span className="ml-3 font-sans text-[0.78rem] text-white/28">
            A {BRAND.parent} product
          </span>
        </p>
        <nav aria-label="Legal" className="mt-3 flex items-center gap-5 text-[0.8rem] text-white/38">
          <Link href="/terms" className="transition-colors duration-500 hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors duration-500 hover:text-white">
            Privacy
          </Link>
          <a
            href={START_HREF}
            className="text-echo-mint/80 transition-colors duration-500 hover:text-echo-mint"
          >
            {FOOTER.cta} →
          </a>
        </nav>
      </div>
      <p className="max-w-md text-[0.74rem] leading-relaxed text-white/28 sm:text-right">
        {FOOTER.legal}
      </p>
    </div>
  );
}
