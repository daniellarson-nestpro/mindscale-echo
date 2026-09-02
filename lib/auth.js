import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getSql } from './db';

export const SESSION_COOKIE = 'echo_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days
const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

export async function issueMagicLink(email) {
  const sql = await getSql();
  if (!sql) return { error: 'database' };
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();

  await sql`DELETE FROM magic_links WHERE email = ${normalized} AND used_at IS NULL`;
  await sql`
    INSERT INTO magic_links (email, token_hash, expires_at)
    VALUES (${normalized}, ${tokenHash}, ${expiresAt})
  `;

  return { token, expiresAt };
}

export async function consumeMagicLink(token) {
  if (!token) return null;
  const sql = await getSql();
  if (!sql) return null;
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT id, email, expires_at, used_at
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
    RETURNING email
  `;
  if (!used[0]) return null;
  return { email: normalizeEmail(used[0].email) };
}

export function safeRelativePath(value, fallback = '/account') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
