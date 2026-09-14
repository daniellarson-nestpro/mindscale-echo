#!/usr/bin/env node
/**
 * Mindscale Echo — Stripe live-mode cutover, one command.
 *
 * Prereq (dashboard-only, cannot be scripted): reveal the LIVE secret key for the
 * Mindscale Partners account and put it in the envelope as
 *   D:\AI\01-Projects\_env\mindscale_echo.env
 *   STRIPE_SECRET_KEY_LIVE=sk_live_...
 *
 * Then, from the repo root:  node scripts/go-live-stripe.mjs [--dry-run]
 *
 * --rehearse runs the read-only half against the SANDBOX key (a dry run that
 * proves the Stripe calls work before the live key exists). Creates nothing.
 *
 * What it does, in order (all idempotent — safe to rerun):
 *   1. Confirms the live account can take money (charges_enabled).
 *   2. Creates (or reuses) the live Basic $499 / Premium $699 products + prices.
 *   3. Creates the live webhook endpoint for /api/stripe-webhook and captures its secret.
 *   4. Writes STRIPE_*_LIVE and STRIPE_*_SANDBOX into the envelope, then points the
 *      plain STRIPE_* names at the live values.
 *   5. Pushes the four plain names to Vercel PRODUCTION only (Preview stays on the
 *      sandbox so preview deployments and the e2e walk keep working).
 *   6. Prints the rebuild + verification steps.
 *
 * Never prints a secret. Rollback: copy the *_SANDBOX values back onto the plain
 * names and rerun push-env-to-vercel.mjs --only STRIPE_SECRET_KEY,... then redeploy.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVELOPE = 'D:/AI/01-Projects/_env/mindscale_echo.env';
const VERCEL_TOKEN_FILE = 'D:/AI/01-Projects/_env/VERCEL_TOKEN.env';
const SITE = 'https://mindscale-echo.vercel.app';
const WEBHOOK_URL = `${SITE}/api/stripe-webhook`;
const WEBHOOK_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
const PRODUCTS = {
  basic: {
    name: 'Mindscale Echo — Basic Release',
    amount: 49900,
    description:
      'Press release written from your article, approved by you, then placed: live URLs on AP News, Business Insider, and Yahoo Finance.',
  },
  premium: {
    name: 'Mindscale Echo — Premium Release',
    amount: 69900,
    description:
      'Everything in Basic plus 500+ outlets, StreetInsider, Benzinga, AIWire, and an AI visibility report.',
  },
};
const FOUR = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_BASIC', 'STRIPE_PRICE_PREMIUM', 'STRIPE_WEBHOOK_SECRET'];

const rehearse = process.argv.includes('--rehearse');
const dry = process.argv.includes('--dry-run') || rehearse;
const log = (...a) => console.log(...a);

/* ---------- envelope ---------- */

function parseEnv(text) {
  const out = {};
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Set NAME=value in the envelope text: replace the last existing line, else append under a header. */
function setEnvLine(text, name, value) {
  const re = new RegExp(`^[ \\t]*${name}[ \\t]*=.*$`, 'gm');
  const matches = [...text.matchAll(re)];
  if (matches.length) {
    const last = matches[matches.length - 1];
    return text.slice(0, last.index) + `${name}=${value}` + text.slice(last.index + last[0].length);
  }
  const header = '# --- Stripe LIVE cutover (written by scripts/go-live-stripe.mjs) ---';
  if (!text.includes(header)) text = `${text.replace(/\s*$/, '\n')}\n${header}\n`;
  return `${text.replace(/\s*$/, '\n')}${name}=${value}\n`;
}

/* ---------- stripe ---------- */

async function stripe(key, method, path, params) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} → ${res.status}: ${j.error?.message || 'unknown error'}`);
  }
  return j;
}

/* ---------- main ---------- */

if (!existsSync(ENVELOPE)) throw new Error(`envelope not found: ${ENVELOPE}`);
let text = readFileSync(ENVELOPE, 'utf8');
const env = parseEnv(text);

const live = rehearse ? env.STRIPE_SECRET_KEY_SANDBOX || env.STRIPE_SECRET_KEY || '' : env.STRIPE_SECRET_KEY_LIVE || '';
if (rehearse && !live.startsWith('sk_test_')) {
  console.error('--rehearse needs a sk_test_ key in the envelope (STRIPE_SECRET_KEY_SANDBOX or STRIPE_SECRET_KEY).');
  process.exit(2);
}
if (!rehearse && !live.startsWith('sk_live_')) {
  console.error('STRIPE_SECRET_KEY_LIVE is missing or not an sk_live_ key.');
  console.error(
    'Stripe Dashboard → Mindscale Partners → Test mode OFF → Developers → API keys → Secret key → Reveal.'
  );
  console.error(`Paste it into ${ENVELOPE} as STRIPE_SECRET_KEY_LIVE=sk_live_... and rerun.`);
  process.exit(2);
}

// Keep the sandbox values addressable before anything is overwritten.
const sandbox = {
  STRIPE_SECRET_KEY:
    env.STRIPE_SECRET_KEY_SANDBOX ||
    (String(env.STRIPE_SECRET_KEY).startsWith('sk_test_') ? env.STRIPE_SECRET_KEY : ''),
  STRIPE_PRICE_BASIC: env.STRIPE_PRICE_BASIC_SANDBOX || env.STRIPE_PRICE_BASIC || '',
  STRIPE_PRICE_PREMIUM: env.STRIPE_PRICE_PREMIUM_SANDBOX || env.STRIPE_PRICE_PREMIUM || '',
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET_SANDBOX || env.STRIPE_WEBHOOK_SECRET || '',
};

// 1. account
const account = await stripe(live, 'GET', '/v1/account');
const accountName = account.settings?.dashboard?.display_name || account.business_profile?.name || '?';
log(
  `account   : ${account.id} (${accountName}) charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled}`
);
if (!account.charges_enabled && !rehearse) {
  console.error('STOP: charges_enabled is false — the live account is not activated. No live checkout can complete.');
  process.exit(3);
}

// 2. products + prices (reuse by exact name / amount)
const existingProducts = (await stripe(live, 'GET', '/v1/products?active=true&limit=100')).data || [];
const priceIds = {};
for (const [planId, spec] of Object.entries(PRODUCTS)) {
  let product = existingProducts.find((p) => p.name === spec.name);
  if (!product) {
    if (dry) {
      log(`would create product + $${spec.amount / 100} price: ${spec.name}`);
      priceIds[planId] = '(new)';
      continue;
    }
    product = await stripe(live, 'POST', '/v1/products', {
      name: spec.name,
      description: spec.description,
    });
    log(`product   : created ${product.id} ${spec.name}`);
  } else {
    log(`product   : reusing ${product.id} ${spec.name}`);
  }
  const prices = (await stripe(live, 'GET', `/v1/prices?product=${product.id}&active=true&limit=20`)).data || [];
  let price = prices.find(
    (p) => p.unit_amount === spec.amount && p.currency === 'usd' && p.type === 'one_time'
  );
  if (!price) {
    if (dry) {
      log(`would create price: $${spec.amount / 100} on ${product.id}`);
      priceIds[planId] = '(new)';
      continue;
    }
    price = await stripe(live, 'POST', '/v1/prices', {
      product: product.id,
      unit_amount: String(spec.amount),
      currency: 'usd',
    });
    log(`price     : created ${price.id} $${spec.amount / 100} livemode=${price.livemode}`);
  } else {
    log(`price     : reusing ${price.id} $${price.unit_amount / 100} livemode=${price.livemode}`);
  }
  if (!price.livemode && !rehearse) throw new Error(`price ${price.id} is not livemode`);
  priceIds[planId] = price.id;
}

// 3. webhook endpoint (secret is only returned at creation)
const endpoints = (await stripe(live, 'GET', '/v1/webhook_endpoints?limit=100')).data || [];
let hook = endpoints.find((e) => e.url === WEBHOOK_URL);
let webhookSecret = env.STRIPE_WEBHOOK_SECRET_LIVE || '';
if (hook && webhookSecret.startsWith('whsec_')) {
  log(`webhook   : reusing ${hook.id} ${hook.status} (secret already in envelope)`);
} else {
  if (hook) {
    log(`webhook   : ${hook.id} exists but its secret is not in the envelope — recreating`);
    if (!dry) await stripe(live, 'DELETE', `/v1/webhook_endpoints/${hook.id}`);
  }
  if (dry) {
    log(`would create webhook: ${WEBHOOK_URL} [${WEBHOOK_EVENTS.join(', ')}]`);
  } else {
    const params = new URLSearchParams({
      url: WEBHOOK_URL,
      description: 'Mindscale Echo production (live)',
    });
    WEBHOOK_EVENTS.forEach((ev) => params.append('enabled_events[]', ev));
    hook = await stripe(live, 'POST', '/v1/webhook_endpoints', params);
    webhookSecret = hook.secret;
    log(
      `webhook   : created ${hook.id} ${hook.status} secret_ok=${String(webhookSecret).startsWith('whsec_')}`
    );
  }
}

if (dry) {
  log('\n--dry-run: nothing written. Would set in envelope + push to Vercel production:', FOUR.join(' '));
  process.exit(0);
}

// 4. envelope: *_SANDBOX preserved, *_LIVE recorded, plain names → live
const liveValues = {
  STRIPE_SECRET_KEY: live,
  STRIPE_PRICE_BASIC: priceIds.basic,
  STRIPE_PRICE_PREMIUM: priceIds.premium,
  STRIPE_WEBHOOK_SECRET: webhookSecret,
};
for (const name of FOUR) {
  if (sandbox[name]) text = setEnvLine(text, `${name}_SANDBOX`, sandbox[name]);
  text = setEnvLine(text, `${name}_LIVE`, liveValues[name]);
  text = setEnvLine(text, name, liveValues[name]);
}
writeFileSync(ENVELOPE, text, 'utf8');
log(`envelope  : updated ${ENVELOPE} (plain names now LIVE; *_SANDBOX and *_LIVE recorded)`);

// 5. Vercel production only
const { projectId, orgId } = JSON.parse(readFileSync(join(REPO, '.vercel/project.json'), 'utf8'));
let vercelToken = process.env.VERCEL_TOKEN || '';
if (!vercelToken && existsSync(VERCEL_TOKEN_FILE)) {
  const t = parseEnv(readFileSync(VERCEL_TOKEN_FILE, 'utf8'));
  vercelToken = t.VERCEL_TOKEN_API || t.VERCEL_TOKEN || '';
}
if (!vercelToken) throw new Error('no Vercel token (VERCEL_TOKEN env or _env/VERCEL_TOKEN.env)');
const body = FOUR.map((key) => ({
  key,
  value: liveValues[key],
  type: 'encrypted',
  target: ['production'],
}));
const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true&teamId=${orgId}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const j = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(
    'Vercel push FAILED',
    res.status,
    JSON.stringify(j).replace(/"value":"[^"]*"/g, '"value":"<redacted>"').slice(0, 400)
  );
  process.exit(1);
}
const failed = (j.failed || []).map((e) => `${e.error?.key || '?'}:${e.error?.code || 'error'}`);
if (failed.length) {
  console.error('Vercel push failed for:', failed.join(' '));
  process.exit(1);
}
log(`vercel    : production env upserted: ${FOUR.join(' ')} (preview untouched — still sandbox)`);

log(`
next      : Vercel bakes env into the build, so redeploy production, then verify:
  git commit --allow-empty -m "chore: rebuild production for live Stripe keys" && git push origin main
  # after Ready:
  curl -sS -X POST ${SITE}/api/checkout -H "Content-Type: application/json" -d '{"plan":"basic"}'
  # expect 409 draft_required (anonymous checkout is closed). A real approved-draft checkout must return cs_live_…
  # then the $1 smoke charge + refund per echo-live-cutover.md §7.`);
