'use client';

import { useEffect, useRef, useState } from 'react';

const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

/**
 * Counts up once when scrolled into view. Numbers that accumulate read as
 * scale; numbers that sit there read as specs.
 *
 * Renders the final value on the server so the number is correct without JS,
 * then resets to zero on mount to run the count.
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

    setDisplay(0);

    const run = () => {
      if (done.current) return;
      done.current = true;
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
