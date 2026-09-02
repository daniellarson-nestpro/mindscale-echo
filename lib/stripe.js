import Stripe from 'stripe';

let cached = null;

/**
 * Lazily construct the Stripe client so a missing key never crashes the build —
 * only the checkout route, at request time.
 */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return cached;
}

/** Absolute origin used to build Stripe success/cancel return URLs. */
export function resolveOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host && host.startsWith('localhost') ? 'http' : 'https');

  return host ? `${proto}://${host}` : 'http://localhost:3000';
}
