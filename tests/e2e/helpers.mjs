/**
 * Shared plumbing for the end-to-end funnel walk.
 *
 * Everything here reads the gitignored .env.local (the local mirror of the
 * Vercel values). No helper ever prints a secret — only ids, counts and status
 * codes, because this output is pasted into the progress log.
 */
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

/** Playwright workers do not inherit env set by the config file. */
export function loadEnvLocal() {
  const file = new URL('../../.env.local', import.meta.url);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
loadEnvLocal();

/** Only this identity may ever be written or deleted by the walk. */
export const TEST_EMAIL_PATTERN = 'daniel.larson+echoloop%@nestpro.ai';
export const TEST_EMAIL_RE = /^daniel\.larson\+echoloop\d+@nestpro\.ai$/;

export function testIdentity(n = String(Date.now()).slice(-6)) {
  const email = `daniel.larson+echoloop${n}@nestpro.ai`;
  if (!TEST_EMAIL_RE.test(email)) throw new Error(`refusing non-test identity: ${email}`);
  return { n, email, company: `Echo Loop Test ${n}` };
}

let cached = null;
export function db() {
  if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is missing from .env.local');
  if (!cached) cached = neon(process.env.POSTGRES_URL);
  return cached;
}

/**
 * The tagged template cannot take positional params in
 * @neondatabase/serverless, so every call site goes through sql.query().
 */
export async function q(text, params = []) {
  return db().query(text, params);
}

/** Poll until `fn` returns something truthy. Returns that value. */
export async function waitFor(label, fn, { timeout = 120000, interval = 3000 } = {}) {
  const started = Date.now();
  let last = 'no attempt';
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
      last = 'falsy';
    } catch (err) {
      last = err?.message || String(err);
    }
    if (Date.now() - started > timeout) {
      const secs = Math.round((Date.now() - started) / 1000);
      throw new Error(`timed out after ${secs}s waiting for ${label} (last: ${last})`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/* ---------------- Resend (full-access key: list + retrieve) ---------------- */

export async function resendEmailsTo(to, { limit = 100 } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is missing from .env.local');
  const res = await fetch(`https://api.resend.com/emails?limit=${limit}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Resend GET /emails -> ${res.status}`);
  const body = await res.json();
  const needle = String(to).toLowerCase();
  return (body.data || []).filter((e) =>
    (e.to || []).some((a) => String(a).toLowerCase() === needle),
  );
}

export async function resendEmail(id) {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Resend GET /emails/${id} -> ${res.status}`);
  return res.json();
}

export async function waitForEmail(to, subjectRe, opts = {}) {
  return waitFor(
    `Resend email to ${to} matching ${subjectRe}`,
    async () => {
      const list = await resendEmailsTo(to);
      return list.find((e) => subjectRe.test(e.subject || '')) || null;
    },
    opts,
  );
}

/* ---------------- Stripe (test mode only, explicit key) ---------------- */

export async function stripeApi(path, { method = 'GET', form } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing from .env.local');
  if (!key.startsWith('sk_test_')) throw new Error('refusing: STRIPE_SECRET_KEY is not a test key');
  const body = form ? new URLSearchParams(form).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `stripe ${method} ${path} -> ${res.status} ${JSON.stringify(json.error || {}).slice(0, 200)}`,
    );
  }
  return json;
}

/* ---------------- Fixtures ---------------- */

/** 1x1 transparent PNG — real magic bytes, so server-side validation passes. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

/** A script-bearing SVG: the exact stored-XSS shape logo upload must refuse. */
export const SVG_BOMB = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>',
);

/**
 * Real local-news copy (mocoshow.com, September 2026) — the same source the
 * repo compose fixture uses. Over 1,000 characters, so the 100-char floor and
 * the composer both have something factual to work from.
 */
export const ARTICLE_TEXT = [
  'Afghan BBQ and Kabob Restaurant to Celebrate Grand Opening',
  '',
  'By Patrick Herron. Published September 5, 2026.',
  '',
  'Aria Restaurant Grill and Kabob is preparing to celebrate its grand opening at 595 Hungerford Drive in Rockville, taking over the space formerly occupied by Hot Pot Kitchen.',
  '',
  'The new halal Afghan restaurant will hold its grand opening from Friday, September 11 through Monday, September 14, with customers receiving 30% off during the four-day celebration.',
  '',
  'The menu features Afghan cuisine, including a variety of kabobs and rice dishes, along with Qabili Palaw, Mantu, gyros, pizza and additional offerings. The restaurant advertises its food as 100% halal.',
  '',
  'Signage was installed earlier this summer following the permanent closure of Hot Pot Kitchen. The former restaurant specialized in all-you-can-eat hot pot, barbecue skewers, dim sum, stir-fried dishes and noodle soups.',
  '',
  'The owners said the Rockville location is their first restaurant, and that they plan to keep the dining room open seven days a week.',
].join('\n');

/* ---------------- Cleanup ---------------- */

/**
 * Deletes every row, blob and Stripe test customer the walk created.
 * Matching is restricted to the test-identity email; the Neon database is
 * shared with production and with other products.
 */
export async function cleanupTestIdentity(email) {
  if (!TEST_EMAIL_RE.test(email)) {
    throw new Error(`refusing cleanup for non-test identity: ${email}`);
  }
  const out = { email };

  const leads = await q(
    'SELECT id, logo_storage_key, logo_storage_url FROM leads WHERE email = $1',
    [email],
  );
  const orders = await q(
    'SELECT id, stripe_customer_id, stripe_payment_intent_id FROM orders WHERE email = $1',
    [email],
  );
  const leadIds = leads.map((l) => l.id);
  const orderIds = orders.map((o) => o.id);

  if (leadIds.length || orderIds.length) {
    out.status_history = (
      await q(
        'DELETE FROM status_history WHERE lead_id = ANY($1::uuid[]) OR order_id = ANY($2::uuid[]) RETURNING id',
        [leadIds, orderIds],
      )
    ).length;
  }
  if (leadIds.length) {
    out.approvals = (
      await q('DELETE FROM approvals WHERE lead_id = ANY($1::uuid[]) RETURNING id', [leadIds])
    ).length;
    out.compose_runs = (
      await q('DELETE FROM compose_runs WHERE lead_id = ANY($1::uuid[]) RETURNING id', [leadIds])
    ).length;
  }
  out.orders = (await q('DELETE FROM orders WHERE email = $1 RETURNING id', [email])).length;
  out.magic_links = (
    await q('DELETE FROM magic_links WHERE email = $1 RETURNING id', [email])
  ).length;
  out.leads = (await q('DELETE FROM leads WHERE email = $1 RETURNING id', [email])).length;

  const blobUrls = leads.map((l) => l.logo_storage_url).filter(Boolean);
  if (blobUrls.length && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import('@vercel/blob');
    try {
      await del(blobUrls, { token: process.env.BLOB_READ_WRITE_TOKEN });
      out.blobs = blobUrls.length;
    } catch (err) {
      out.blobs = `failed: ${err?.message}`;
    }
  } else {
    out.blobs = 0;
  }

  const customerIds = [...new Set(orders.map((o) => o.stripe_customer_id).filter(Boolean))];
  out.stripe_customers = [];
  for (const id of customerIds) {
    try {
      await stripeApi(`/customers/${id}`, { method: 'DELETE' });
      out.stripe_customers.push(id);
    } catch (err) {
      out.stripe_customers.push(`${id} failed: ${err?.message}`);
    }
  }
  return out;
}

export async function countsForTestIdentity(email) {
  const [row] = await q(
    `SELECT (SELECT count(*) FROM leads WHERE email = $1) AS leads,
            (SELECT count(*) FROM orders WHERE email = $1) AS orders,
            (SELECT count(*) FROM magic_links WHERE email = $1) AS magic_links`,
    [email],
  );
  return row;
}
