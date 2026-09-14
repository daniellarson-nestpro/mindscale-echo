'use client';

import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/**
 * Counts up once when scrolled into view. Numbers that accumulate read as
 * scale; numbers that sit there read as specs.
 *
 * The final value is in the HTML and stays in the DOM until the element is
 * actually on screen: the count only drops to zero the instant it starts, so
 * no crawler, screenshot, or reader ever sees "0+".
 */
export default function Odometer({ value, suffix = '', duration = 1100, className = '' }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const run = () => {
      if (done.current) return;
      done.current = true;
      setDisplay(0);
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        setDisplay(Math.round(easeOutExpo(p) * value));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span
      ref={ref}
      data-odometer={value}
      data-suffix={suffix}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {new Intl.NumberFormat('en-US').format(display)}
      {suffix}
    </span>
  );
}
