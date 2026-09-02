import { BRAND } from '../lib/content';

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative pb-14 pt-8">
      <div className="page-shell">
        <div className="flex flex-col items-center justify-between gap-5 border-t border-white/[0.07] pt-8 sm:flex-row">
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
