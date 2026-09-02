import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getSql } from './db';
import {
  CODE_MAX_ATTEMPTS,
  V2_LINK_TTL_MS,
  evaluateCodeAttempt,
  formatCodeDisplay,
  generateNumericCode,
  hashCode,
  normalizeCode,
} from './codes';

export const SESSION_COOKIE = 'echo_session';
export const PENDING_COOKIE = 'echo_pending';
const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days
const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // V1 login
const PENDING_TTL_MS = V2_LINK_TTL_MS;

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return '';
  return 'dev-insecure-auth-secret-change-me';
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

export function pendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(PENDING_TTL_MS / 1000),
  };
}

function sign(payload) {
  const secret = getAuthSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(email) {
  const secret = getAuthSecret();
  if (!secret) return '';
  const body = Buffer.from(
    JSON.stringify({
      email: normalizeEmail(email),
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token) {
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
    if (!payload?.email || !payload?.exp || payload.exp < Date.now()) return null;
    if (!isValidEmail(payload.email)) return null;
    return { email: normalizeEmail(payload.email) };
  } catch {
    return null;
  }
}

export function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return readSessionToken(token);
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createPendingToken({ email, linkId }) {
  const secret = getAuthSecret();
  if (!secret || !linkId) return '';
  const body = Buffer.from(
    JSON.stringify({
      email: normalizeEmail(email),
      linkId,
      exp: Date.now() + PENDING_TTL_MS,
    })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readPendingToken(token) {
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
    if (!payload?.email || !payload?.linkId || !payload?.exp || payload.exp < Date.now()) return null;
    if (!isValidEmail(payload.email)) return null;
    return { email: normalizeEmail(payload.email), linkId: payload.linkId };
  } catch {
    return null;
  }
}

/**
 * V1 login: 30 min, token only.
 * V2 start: pass { withCode: true, ttlMs: V2_LINK_TTL_MS, nextPath }.
 */
export async function issueMagicLink(email, options = {}) {
  const sql = await getSql();
  if (!sql) return { error: 'database' };
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const ttlMs = typeof options.ttlMs === 'number' ? options.ttlMs : MAGIC_LINK_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const nextPath = options.nextPath || null;

  let code = null;
  let codeDisplay = null;
  let codeHash = null;
  if (options.withCode) {
    code = generateNumericCode();
    codeDisplay = formatCodeDisplay(code);
    codeHash = hashCode(code, getAuthSecret());
    if (!codeHash) return { error: 'database' };
  }

  await sql`DELETE FROM magic_links WHERE email = ${normalized} AND used_at IS NULL`;
  const rows = await sql`
    INSERT INTO magic_links (email, token_hash, expires_at, code_hash, attempts, next_path)
    VALUES (${normalized}, ${tokenHash}, ${expiresAt}, ${codeHash}, 0, ${nextPath})
    RETURNING id
  `;

  return { token, expiresAt, id: rows[0]?.id || null, code, codeDisplay };
}

export async function consumeMagicLink(token) {
  if (!token) return null;
  const sql = await getSql();
  if (!sql) return null;
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT id, email, expires_at, used_at, next_path
    FROM magic_links
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const used = await sql`
    UPDATE magic_links
    SET used_at = now()
    WHERE id = ${row.id} AND used_at IS NULL
    RETURNING email, next_path
  `;
  if (!used[0]) return null;
  return { email: normalizeEmail(used[0].email), nextPath: used[0].next_path || null };
}

export async function consumeMagicCode(email, rawCode) {
  const sql = await getSql();
  if (!sql) return { error: 'database' };
  const normalized = normalizeEmail(email);
  const digits = normalizeCode(rawCode);
  const secret = getAuthSecret();

  const rows = await sql`
    SELECT id, email, code_hash, expires_at, used_at, attempts, next_path
    FROM magic_links
    WHERE email = ${normalized} AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0] || null;
  const decision = evaluateCodeAttempt({ row, code: digits, secret });

  const live =
    row &&
    row.code_hash &&
    !row.used_at &&
    new Date(row.expires_at).getTime() >= Date.now() &&
    (row.attempts || 0) < CODE_MAX_ATTEMPTS;
  if (live) {
    await sql`
      UPDATE magic_links
      SET attempts = attempts + 1
      WHERE id = ${row.id} AND used_at IS NULL
    `;
  }

  if (!decision.ok) return { error: decision.error };

  const used = await sql`
    UPDATE magic_links
    SET used_at = now()
    WHERE id = ${row.id} AND used_at IS NULL
    RETURNING email, next_path
  `;
  if (!used[0]) return { error: 'invalid' };
  return { email: normalizeEmail(used[0].email), nextPath: used[0].next_path || null };
}

export async function peekPendingRedemption(pending) {
  if (!pending?.linkId || !pending?.email) return null;
  const sql = await getSql();
  if (!sql) return null;
  const rows = await sql`
    SELECT email, used_at, next_path
    FROM magic_links
    WHERE id = ${pending.linkId} AND email = ${normalizeEmail(pending.email)}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.used_at) return null;
  return { email: normalizeEmail(row.email), nextPath: row.next_path || null };
}

export function safeRelativePath(value, fallback = '/account') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
