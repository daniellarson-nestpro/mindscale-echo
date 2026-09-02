/**
 * Process-local sliding window. Same style as the login cooldown Map —
 * good enough for a single Fluid instance; not a global store.
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, times] of hits) {
      const next = times.filter((t) => now - t < windowMs);
      if (next.length) hits.set(key, next);
      else hits.delete(key);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      if (hits.size > 4000) prune(now);
      const times = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (times.length >= max) {
        hits.set(key, times);
        return { ok: false, remaining: 0 };
      }
      times.push(now);
      hits.set(key, times);
      return { ok: true, remaining: max - times.length };
    },
    reset() {
      hits.clear();
    },
  };
}

export function clientIp(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-for') || '';
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first.slice(0, 128);
  }
  const real = request?.headers?.get?.('x-real-ip') || '';
  if (real) return real.slice(0, 128);
  return 'unknown';
}
