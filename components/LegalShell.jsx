import Link from 'next/link';
import Nav from './Nav';
import AppFooter from './AppFooter';
import LegalDoc from './LegalDoc';
import { ArrowUpRight } from './Icons';
import { BRAND, START_HREF } from '../lib/content';
import { SUPPORT_EMAIL } from '../lib/funnel';

const TABS = [
  { href: '/terms', label: 'Terms of Service', key: 'terms' },
  { href: '/privacy', label: 'Privacy Policy', key: 'privacy' },
];

/** Page chrome for the legal pages: nav, eyebrow, tab switcher, content column, footer. */
export default function LegalShell({ eyebrow, current, markdown }) {
  return (
    <>
      <Nav />
      <main className="relative overflow-hidden pb-16 pt-28 sm:pt-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 opacity-60"
          style={{
            background: 'radial-gradient(50rem 30rem at 50% 0%, rgba(47,211,154,0.14), transparent 65%)',
          }}
        />
        <div className="page-shell relative">
          <div className="mx-auto max-w-[46rem]">
            <span className="eyebrow eyebrow-dot">{eyebrow}</span>

            <nav className="mt-8 flex items-center gap-2" aria-label="Legal documents">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-current={current === t.key ? 'page' : undefined}
                  className={
                    'rounded-full px-4 py-1.5 text-[0.82rem] transition-colors duration-500 ' +
                    (current === t.key
                      ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(127,240,192,0.25)]'
                      : 'text-white/45 hover:text-white')
                  }
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            <div className="rule mt-8" />

            <article className="mt-10">
              <LegalDoc markdown={markdown} />
            </article>

            <div className="rule mt-16" />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.82rem] text-white/38">Questions? {SUPPORT_EMAIL}</p>
              <a href={START_HREF} className="btn btn-primary w-max text-[0.85rem]">
                {BRAND.primaryCta}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
            </div>
          </div>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
