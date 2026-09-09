'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from './Icons';
import AuthNavLink from './AuthNavLink';

const LINKS = [
  { id: 'reach', label: 'Reach' },
  { id: 'trophy', label: 'Example' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

export default function Nav({ userEmail = '' }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Same-page anchors on the landing page (no navigation, no dependency on
  // being served from the domain root); absolute links from /success, /cancel.
  const isHome = pathname === '/';
  const to = (id) => (isHome ? `#${id}` : `/#${id}`);
  const links = LINKS.map((l) => ({ ...l, href: to(l.id) }));
  const buyHref = to('pricing');

  // Release the scroll lock synchronously: React's state update is batched, so
  // clearing it in an effect can land after the browser's fragment jump — and
  // a locked body silently cancels that scroll on mobile.
  const closeAndJump = () => {
    document.body.style.overflow = '';
    setOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-5 sm:pt-6">
        <nav
          className="glass-fixed pointer-events-auto flex w-full max-w-page items-center justify-between gap-6 rounded-full py-2 pl-5 pr-2 sm:w-max sm:gap-10"
          style={{
            background: 'rgba(10,10,12,0.62)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.13), 0 24px 60px -30px rgba(0,0,0,0.95)',
          }}
        >
          <a href={isHome ? "#top" : "/#top"} className="flex shrink-0 items-center gap-2.5">
            <Mark />
            <span className="font-display text-[0.98rem] tracking-[-0.02em] text-white">
              Mindscale <span className="text-white/45">Echo</span>
            </span>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[0.85rem] text-white/55 transition-colors duration-500 ease-haptic hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {userEmail ? (
              <>
                <a
                  href="/account"
                  className="text-[0.85rem] text-white/55 transition-colors duration-500 ease-haptic hover:text-white"
                >
                  Workspace
                </a>
                <form action="/api/auth/logout" method="POST" className="hidden sm:block">
                  <button
                    type="submit"
                    className="text-[0.85rem] text-white/45 transition-colors duration-500 ease-haptic hover:text-white"
                  >
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <AuthNavLink className="text-[0.85rem] text-white/55 transition-colors duration-500 ease-haptic hover:text-white" />
            )}
            <a href={buyHref} className="btn btn-primary hidden text-[0.85rem] sm:inline-flex">
              Launch My Release
              <span className="btn-nib">
                <ArrowUpRight />
              </span>
            </a>
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
              style={{
                background: 'rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              <span
                className="absolute block h-px w-4 bg-white transition-transform duration-700 ease-haptic"
                style={{
                  transform: open ? 'translateY(0) rotate(45deg)' : 'translateY(-3px)',
                }}
              />
              <span
                className="absolute block h-px w-4 bg-white transition-transform duration-700 ease-haptic"
                style={{
                  transform: open ? 'translateY(0) rotate(-45deg)' : 'translateY(3px)',
                }}
              />
            </button>
          </div>
        </nav>
      </header>

      <div
        className="glass-fixed fixed inset-0 z-20 flex flex-col justify-center px-8 lg:hidden"
        style={{
          background: 'rgba(5,5,6,0.86)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 700ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li
              key={l.href}
              style={{
                transform: open ? 'translateY(0)' : 'translateY(3rem)',
                opacity: open ? 1 : 0,
                transition: `transform 800ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 60}ms, opacity 800ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 60}ms`,
              }}
            >
              <a
                href={l.href}
                onClick={closeAndJump}
                className="block py-2 font-display text-[2.6rem] leading-none text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        {userEmail ? (
          <>
            <a
              href="/account"
              onClick={() => setOpen(false)}
              className="mt-10 block py-2 font-display text-[2.2rem] leading-none text-white"
            >
              Workspace
            </a>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="mt-2 block py-2 font-display text-[2.2rem] leading-none text-white/55"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <AuthNavLink
            onClick={() => setOpen(false)}
            className="mt-10 block py-2 font-display text-[2.2rem] leading-none text-white"
          />
        )}
        <a
          href={buyHref}
          onClick={closeAndJump}
          className="btn btn-primary mt-12 w-max"
          style={{
            transform: open ? 'translateY(0)' : 'translateY(3rem)',
            opacity: open ? 1 : 0,
            transition:
              'transform 800ms cubic-bezier(0.16,1,0.3,1) 420ms, opacity 800ms cubic-bezier(0.16,1,0.3,1) 420ms',
          }}
        >
          Launch My Release
          <span className="btn-nib">
            <ArrowUpRight />
          </span>
        </a>
      </div>
    </>
  );
}

function Mark() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full"
      style={{
        background: 'linear-gradient(150deg, rgba(127,240,192,0.9), rgba(109,92,246,0.75))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="2.2" fill="#050506" />
        <path
          d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 17.4a7.6 7.6 0 0 0 0-10.8"
          stroke="#050506"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
