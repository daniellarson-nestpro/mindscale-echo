import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const V2_LINK_TTL_MS = 20 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 8;

export function generateNumericCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function formatCodeDisplay(code) {
  const digits = normalizeCode(code);
  if (digits.length !== 6) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeCode(value) {
  return String(value || '').replace(/[\s-]/g, '');
}

export function isValidCode(value) {
  return /^\d{6}$/.test(normalizeCode(value));
}

export function hashCode(code, secret) {
  const digits = normalizeCode(code);
  if (!secret || !digits) return '';
  return createHmac('sha256', secret).update(digits).digest('hex');
}

export function codesMatch(provided, storedHash, secret) {
  const expected = typeof storedHash === 'string' ? storedHash : '';
  const actual = hashCode(provided, secret);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected || hashCode('000000', secret || 'x'));
  if (!expected || !actual || a.length !== b.length) {
    if (a.length === b.length) timingSafeEqual(a, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Pure decision for a code redeem. Does not mutate storage.
 * `row` is the unused magic_links row for that email (or null).
 */
export function evaluateCodeAttempt({ row, code, secret, now = Date.now() }) {
  const digits = normalizeCode(code);
  if (!isValidCode(digits)) return { ok: false, error: 'invalid' };
  if (!row || !row.code_hash) return { ok: false, error: 'invalid' };
  if (row.used_at) return { ok: false, error: 'invalid' };
  if (new Date(row.expires_at).getTime() < now) return { ok: false, error: 'expired' };
  if ((row.attempts || 0) >= CODE_MAX_ATTEMPTS) return { ok: false, error: 'invalid' };
  if (!codesMatch(digits, row.code_hash, secret)) return { ok: false, error: 'invalid' };
  return { ok: true };
}

export function startOkBody(email) {
  return { ok: true, email };
}

export function verifyErrorBody(error) {
  return { ok: false, error: error === 'expired' ? 'expired' : 'invalid' };
}
