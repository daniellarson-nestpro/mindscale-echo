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

function stripSlash(value) {
  return String(value).replace(/\/$/, '');
}

function originFromVercelUrl() {
  const raw = process.env.VERCEL_URL;
  if (!raw) return '';
  const host = stripSlash(raw.replace(/^https?:\/\//, ''));
  if (!host || /[^\w.-]/.test(host)) return '';
  return `https://${host}`;
}

/** Origin from env only — never from Host / X-Forwarded-* headers. */
export function configuredSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return stripSlash(configured);
  return originFromVercelUrl();
}

function localhostOrigin(request) {
  if (process.env.NODE_ENV === 'production') return '';
  const host = request?.headers?.get?.('host') || '';
  if (!host) return 'http://localhost:3000';
  const hostname = host.split(':')[0];
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${host}`;
  }
  return '';
}

/**
 * Absolute origin for Stripe return URLs and in-app redirects.
 * Prefers NEXT_PUBLIC_SITE_URL, then Vercel’s VERCEL_URL. Request Host
 * headers are only used for localhost in non-production.
 */
export function resolveOrigin(request) {
  return configuredSiteOrigin() || localhostOrigin(request) || 'http://localhost:3000';
}

/**
 * Origin for emailed magic links. Never derived from client-controlled
 * Host / X-Forwarded-Host, which would let an attacker exfiltrate the token.
 */
export function authSiteOrigin(request) {
  return configuredSiteOrigin() || localhostOrigin(request);
}
