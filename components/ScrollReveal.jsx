'use client';

import { useEffect } from 'react';

/**
 * Adds `.js` to <html> (which arms the reveal styles — without JS everything
 * renders visible), then reveals `.reveal` nodes via IntersectionObserver.
 * No scroll listeners: transform/opacity only.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      root.classList.remove('js');
      return undefined;
    }

    root.classList.add('js');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    const nodes = Array.from(document.querySelectorAll('.reveal'));
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        node.classList.add('is-visible');
      } else {
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
