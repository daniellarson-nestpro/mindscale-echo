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
  // compose_runs: exact outbound payload snapshot + n8n response per attempt
  await sql`
    CREATE TABLE IF NOT EXISTS compose_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL,
      request_payload JSONB NOT NULL,
      request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      response_payload JSONB,
      response_at TIMESTAMPTZ,
      ok BOOLEAN,
      error TEXT,
      n8n_run_id TEXT,
      http_status INTEGER,
      duration_ms INTEGER,
      attempts INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS compose_runs_lead_id_idx ON compose_runs (lead_id)`;

  // status_history: order status transitions
  await sql`
    CREATE TABLE IF NOT EXISTS status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID,
      order_id UUID,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS status_history_lead_id_idx ON status_history (lead_id)`;
  await sql`CREATE INDEX IF NOT EXISTS status_history_order_id_idx ON status_history (order_id)`;

  // approvals: customer approval checkbox records
  await sql`
    CREATE TABLE IF NOT EXISTS approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL,
      order_id UUID,
      approver_email TEXT NOT NULL,
      checkbox_version TEXT NOT NULL DEFAULT 'v1',
      checkbox_copy TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS approvals_lead_id_idx ON approvals (lead_id)`;

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
      confirmation_email_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS lead_id UUID`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS compose_run_id UUID`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'paid'`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pr_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS logo_storage_key TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS logo_storage_url TEXT`;
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
  await sql`ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS code_hash TEXT`;
  await sql`ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS next_path TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      phone TEXT,
      company_name TEXT,
      website TEXT,
      announcement_type TEXT,
      article_url TEXT,
      article_text TEXT,
      quote TEXT,
      quote_attribution TEXT,
      notes TEXT,
      furthest_step TEXT NOT NULL DEFAULT 'brief',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      verified_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_json TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_started_at TIMESTAMPTZ`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_finished_at TIMESTAMPTZ`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS article_source TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_storage_key TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_storage_url TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_name TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_type TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_size INTEGER`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_compose_run_id UUID`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_status TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email)`;
}
