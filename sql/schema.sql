-- Mindscale Echo — customer orders + magic-link tokens
-- Applied automatically on first DB request (see lib/db.js).
-- You can also paste this into the Neon SQL editor.
-- Retention policy: all customer data retained for 60 months minimum.
-- Do not build automated deletion without explicit product owner approval.

-- compose_runs: exact outbound payload snapshot BEFORE every n8n call,
-- plus exact response after. This table is the durable audit trail.
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
);
CREATE INDEX IF NOT EXISTS compose_runs_lead_id_idx ON compose_runs (lead_id);

-- status_history: order/lead status transitions
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  order_id UUID,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_history_lead_id_idx ON status_history (lead_id);
CREATE INDEX IF NOT EXISTS status_history_order_id_idx ON status_history (order_id);

-- approvals: customer checkbox approval records
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
);
CREATE INDEX IF NOT EXISTS approvals_lead_id_idx ON approvals (lead_id);

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
);

-- Existing databases: CREATE TABLE IF NOT EXISTS will not add new columns.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS compose_run_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pr_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logo_storage_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logo_storage_url TEXT;

CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (email);

CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links (email);

-- V2: 6-digit code lives on the same attempt as the long token.
ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS next_path TEXT;

-- Unpurchased briefs cannot live on orders (stripe_session_id is NOT NULL UNIQUE).
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
);

-- n8n compose: saved draft JSON + in-flight lock. Additive; upsertLead does not touch these.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_json TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_started_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS compose_finished_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS article_source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_storage_key TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_storage_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_size INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_compose_run_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_status TEXT;

CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);
