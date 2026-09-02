import { neon } from '@neondatabase/serverless';

let cached = null;
let schemaPromise = null;

function connectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

export function isDatabaseConfigured() {
  return Boolean(connectionString());
}

/**
 * Neon HTTP client. Tables are created on first use so a Marketplace
 * Postgres install works without a separate migrate step.
 */
export async function getSql() {
  const url = connectionString();
  if (!url) return null;
  if (!cached) cached = neon(url);
  if (!schemaPromise) {
    schemaPromise = ensureSchema(cached).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
  return cached;
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_session_id TEXT NOT NULL UNIQUE,
      stripe_payment_intent_id TEXT,
      plan TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at TIMESTAMPTZ,
      company_name TEXT,
      website TEXT,
      contact_name TEXT,
      contact_email TEXT,
      article_url TEXT,
      announcement_type TEXT,
      quote TEXT,
      quote_attribution TEXT,
      notes TEXT,
      logo_name TEXT,
      logo_type TEXT,
      logo_size INTEGER,
      brief_submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS magic_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links (email)`;
}
