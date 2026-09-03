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

/** Stripe customer_email / metadata — reject anything that doesn't look like an address. */
export function looksLikeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  return email;
}

/** Preview path segment only: no slashes, dots, or query injection. */
export function safePreviewToken(value, fallback = 'demo') {
  if (typeof value !== 'string') return fallback;
  const token = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(token)) return fallback;
  return token;
}

/**
 * Append session_id / plan / token to a relative path unless already present.
 * Leaves Stripe's {CHECKOUT_SESSION_ID} placeholder unencoded so Checkout
 * can substitute it.
 */
export function appendCheckoutParams(
  path,
  { planId, token, sessionPlaceholder = '{CHECKOUT_SESSION_ID}' },
) {
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
  if (token && !have.has('token')) {
    parts.push(`token=${encodeURIComponent(token)}`);
  }

  return `${pathname}?${parts.join('&')}${hash}`;
}
