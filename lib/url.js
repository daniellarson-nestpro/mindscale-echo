/**
 * Open-redirect guards for checkout return URLs.
 * Only same-origin relative paths: must start with "/" and not "//".
 */
export function safeRelativePath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  if (path.includes('\\') || path.includes('\0') || /[\r\n]/.test(path)) return null;
  if (path.length > 2048) return null;
  return path;
}

/**
 * Append session_id / plan to a relative path unless already present.
 * Leaves Stripe's {CHECKOUT_SESSION_ID} placeholder unencoded so Checkout
 * can substitute it.
 */
export function appendCheckoutParams(path, { planId, sessionPlaceholder = '{CHECKOUT_SESSION_ID}' }) {
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = withoutHash.indexOf('?');
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const existing = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : '';

  const have = new Set();
  if (existing) {
    for (const part of existing.split('&')) {
      const key = decodeURIComponent((part.split('=')[0] || '').replace(/\+/g, ' '));
      if (key) have.add(key);
    }
  }

  const parts = existing ? [existing] : [];
  if (!have.has('session_id')) {
    parts.push(`session_id=${sessionPlaceholder}`);
  }
  if (!have.has('plan')) {
    parts.push(`plan=${encodeURIComponent(planId)}`);
  }

  return `${pathname}?${parts.join('&')}${hash}`;
}
