import { createHmac, timingSafeEqual } from 'crypto';
import { getAuthSecret } from './auth';
import { sanitizePrefill } from './prefill-fields';

export {
  cleanPhone,
  mergeStartLeadFields,
  prefillToLeadFields,
  sanitizeContext,
  sanitizePrefill,
} from './prefill-fields';

export const PREFILL_COOKIE = 'echo_prefill';
export const PREFILL_TTL_MS = 10 * 60 * 1000;

function sign(payload) {
  const secret = getAuthSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function prefillCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(PREFILL_TTL_MS / 1000),
  };
}

export function createPrefillToken(payload) {
  const secret = getAuthSecret();
  if (!secret) return '';
  const clean = sanitizePrefill(payload);
  const body = Buffer.from(
    JSON.stringify({
      ...clean,
      exp: Date.now() + PREFILL_TTL_MS,
    })
  ).toString('base64url');
  const mac = sign(body);
  if (!mac) return '';
  return `${body}.${mac}`;
}

export function readPrefillToken(token) {
  if (!token || typeof token !== 'string' || !getAuthSecret()) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  if (!expected) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return sanitizePrefill(payload);
  } catch {
    return null;
  }
}
