'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from './Icons';

/**
 * Mobile-only. Without this there is no way to buy for ~9,000px after the hero
 * CTA scrolls away. Appears past 55% scroll, hides once pricing is on screen.
 */
export default function StickyBuyBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let ticking = false;

    const evaluate = () => {
      ticking = false;
      const scrolled = window.scrollY;
      const max = document.body.scrollHeight - window.innerHeight;
      const past = max > 0 ? scrolled / max : 0;

      const pricing = document.getElementById('pricing');
      let pricingVisible = false;
      if (pricing) {
        const r = pricing.getBoundingClientRect();
        pricingVisible = r.top < window.innerHeight && r.bottom > 0;
      }
      setShow(past > 0.12 && past < 0.94 && !pricingVisible);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(evaluate);
      }
    };

    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className="sticky-buy glass-fixed lg:hidden"
      style={{
        transform: show ? 'translateY(0)' : 'translateY(140%)',
        opacity: show ? 1 : 0,
      }}
    >
      <a href="#pricing" className="btn btn-primary w-full justify-between">
        Launch My Release — $499
        <span className="btn-nib">
          <ArrowUpRight />
        </span>
      </a>
    </div>
  );
}
