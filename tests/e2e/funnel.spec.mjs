/**
 * The whole product in one test: a stranger arrives, pastes the article a
 * local paper wrote about them, gets a code by email, fills the brief, reads a
 * real composed release, approves it, pays with a test card, and the owner
 * marks it submitted. Every claim the funnel makes is checked against the
 * database, Stripe and Resend — not against the UI alone.
 *
 *   BASE_URL=https://mindscale-echo.vercel.app npm run e2e
 *   BASE_URL=https://mindscale-echo-git-v1-merge-oglow.vercel.app npm run e2e
 *
 * Runs against a deployed environment (Preview or Production) because the
 * Stripe webhook, Vercel Blob and Resend only exist there. Stripe is test
 * mode; the test refuses to run against a live key. Everything it creates is
 * deleted in afterAll unless KEEP_TEST_DATA=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  ARTICLE_TEXT,
  PNG_1X1,
  SVG_BOMB,
  cleanupTestIdentity,
  countsForTestIdentity,
  q,
  resendEmail,
  stripeApi,
  testIdentity,
  waitFor,
  waitForEmail,
} from './helpers.mjs';

const identity = testIdentity(process.env.ECHO_TEST_N || String(Date.now()).slice(-6));
const EMAIL = identity.email;
const COMPANY = identity.company;
const CONTACT = 'Echo Loop Tester';
const PHONE = '612-555-0148';
const PLAN = { id: 'basic', cents: 49900, label: 'Basic', priceLabel: '$499' };

const evidence = {
  email: EMAIL,
  company: COMPANY,
  plan: PLAN.id,
  baseURL: process.env.BASE_URL || 'https://mindscale-echo.vercel.app',
  startedAt: new Date().toISOString(),
  steps: {},
};

function note(key, value) {
  evidence.steps[key] = value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  console.log(`[walk] ${key}: ${text}`);
}

async function fillIfPresent(page, selector, value, { type = false } = {}) {
  const field = page.locator(selector).first();
  if (!(await field.count())) return false;
  if (!(await field.isVisible().catch(() => false))) return false;
  if (type) await field.pressSequentially(value, { delay: 18 });
  else await field.fill(value);
  return true;
}

/** The hosted Stripe Checkout page (no iframes; inputs carry stable ids). */
async function payWithTestCard(page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 120000 });
  const cardNumber = page.locator('#cardNumber');
  await cardNumber.waitFor({ state: 'visible', timeout: 90000 });
  note('stripe_checkout_url', new URL(page.url()).pathname.slice(0, 24) + '…');

  await fillIfPresent(page, '#email', EMAIL);
  await cardNumber.pressSequentially('4242424242424242', { delay: 18 });
  await fillIfPresent(page, '#cardExpiry', '1234', { type: true });
  await fillIfPresent(page, '#cardCvc', '123', { type: true });
  await fillIfPresent(page, '#billingName', CONTACT);
  await fillIfPresent(page, '#billingPostalCode', '55401', { type: true });
  await fillIfPresent(page, '#phoneNumber', '6125550148', { type: true });

  const submit = page
    .locator('[data-testid="hosted-payment-submit-button"], .SubmitButton, button[type="submit"]')
    .first();
  await submit.click();
}

test.describe.configure({ mode: 'serial' });

test('a stranger pays for a release and receives it', async ({ page }) => {
  /* ---------- 0. preconditions ---------- */
  expect(process.env.POSTGRES_URL, 'POSTGRES_URL in .env.local').toBeTruthy();
  expect(process.env.RESEND_API_KEY, 'RESEND_API_KEY in .env.local').toBeTruthy();
  expect(process.env.ADMIN_SECRET, 'ADMIN_SECRET in .env.local').toBeTruthy();
  expect(process.env.STRIPE_SECRET_KEY || '', 'Stripe key must be test mode').toMatch(/^sk_test_/);
  note('identity', { email: EMAIL, company: COMPANY });

  const before = await countsForTestIdentity(EMAIL);
  expect(Number(before.leads), 'test identity must start clean').toBe(0);
  expect(Number(before.orders), 'test identity must start clean').toBe(0);

  /* ---------- 1. /start — paste the article the paper wrote ---------- */
  await page.goto('/start');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Got written up?');

  const articleBox = page.getByLabel('Article text');
  await articleBox.fill(ARTICLE_TEXT);
  await articleBox.press('Enter');
  await expect(page.getByText(/characters · pasted text/)).toBeVisible();
  note('article_pasted_chars', ARTICLE_TEXT.length);

  await page.getByRole('button', { name: 'Continue' }).click();

  /* ---------- 2. email gate ---------- */
  await page.locator('#email').fill(EMAIL);
  const startResponse = page.waitForResponse(
    (r) => r.url().includes('/api/auth/start') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Send my code/i }).click();
  expect((await startResponse).status(), 'POST /api/auth/start').toBe(200);
  await page.waitForURL(/\/start\/verify/, { timeout: 60000 });

  /* ---------- 3. the 6-digit code, read out of Resend ---------- */
  const codeEmail = await waitForEmail(EMAIL, /Mindscale Echo code: \d{6}/, { timeout: 180000 });
  const code = codeEmail.subject.match(/(\d{6})/)[1];
  note('code_email', { id: codeEmail.id, last_event: codeEmail.last_event, from: codeEmail.from });
  expect(code).toHaveLength(6);

  await page.locator('#contactName').fill(CONTACT);
  await page.locator('#phone').fill(PHONE);
  await page.locator('#code').fill(code); // six digits autosubmits
  await page.waitForURL(/\/brief/, { timeout: 90000 });
  note('verified', 'session established, landed on /brief');

  /* ---------- 4. the brief ---------- */
  // The form must actually render: an undefined handler in the JSX took the
  // whole client component down on this branch once, and the page still
  // answered 200 with an empty shell.
  await expect(page.locator('#companyName')).toBeVisible();
  await expect(page.getByText(/characters · pasted text/)).toBeVisible();

  await page.locator('#companyName').fill(COMPANY);
  await page.locator('#website').fill('echolooptest.example.com');
  await page.locator('#contactName').fill(CONTACT);
  await page.locator('#contactEmail').fill(EMAIL);
  await page.locator('#phone').fill(PHONE);
  await page.getByRole('button', { name: 'Grand opening' }).click();
  await page.locator('#quote').fill(
    'We have cooked for this neighborhood for years, and opening on Hungerford Drive means a whole new set of regulars.',
  );
  await page.locator('#quoteAttribution').fill(`${CONTACT}, Owner`);

  // Logo: a real PNG is stored, an SVG is refused in the browser and again by
  // the API (blobs are served with the content type we give them).
  const logoResponse = page.waitForResponse(
    (r) => r.url().includes('/api/logo') && r.request().method() === 'POST',
    { timeout: 90000 },
  );
  await page.setInputFiles('input[name="logo"]', {
    name: 'echo-loop-logo.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
  const logoJson = await (await logoResponse).json();
  expect(logoJson.ok, 'PNG logo upload').toBe(true);
  expect(logoJson.logoUrl).toMatch(/^https:\/\//);
  note('logo_png_upload', { ok: logoJson.ok, type: logoJson.type, size: logoJson.size });

  await page.setInputFiles('input[name="logo"]', {
    name: 'evil.svg',
    mimeType: 'image/svg+xml',
    buffer: SVG_BOMB,
  });
  await expect(page.getByText('We need an image file — PNG, JPG, or WebP.')).toBeVisible();

  const svgApi = await page.request.post('/api/logo', {
    multipart: { logo: { name: 'evil.svg', mimeType: 'image/svg+xml', buffer: SVG_BOMB } },
  });
  const svgBody = await svgApi.json().catch(() => ({}));
  expect(svgApi.status(), 'POST /api/logo with an SVG').toBe(422);
  expect(svgBody.error).toMatch(/PNG, JPEG, or WebP/);
  note('logo_svg_rejected', { ui: 'refused', api_status: svgApi.status() });

  /* ---------- 5. compose (a real Anthropic call) ---------- */
  const composeResponse = page.waitForResponse(
    (r) => r.url().includes('/api/brief/complete') && r.request().method() === 'POST',
    { timeout: 300000 },
  );
  await page.getByRole('button', { name: 'See my draft' }).click();
  const compose = await composeResponse;
  const composeJson = await compose.json();
  expect(compose.status(), 'POST /api/brief/complete').toBe(200);
  expect(composeJson.ok, 'compose ok').toBe(true);
  note('compose_response', { status: compose.status(), ok: composeJson.ok });

  await page.waitForURL(/\/preview\/[0-9a-f-]{10,}/, { timeout: 120000 });
  const leadId = new URL(page.url()).pathname.split('/').pop();
  note('lead_id', leadId);

  /* ---------- 6. the database agrees ---------- */
  const [lead] = await q(
    'SELECT id, email, company_name, announcement_type, verified_at, compose_json, compose_finished_at, furthest_step, order_status, logo_storage_url, logo_storage_key, current_compose_run_id FROM leads WHERE email = $1',
    [EMAIL],
  );
  expect(lead, 'leads row').toBeTruthy();
  expect(lead.id).toBe(leadId);
  expect(lead.company_name).toBe(COMPANY);
  expect(lead.verified_at).toBeTruthy();
  expect(lead.logo_storage_url, 'logo stored on the lead').toBeTruthy();
  const draft = JSON.parse(lead.compose_json);
  expect(draft.ok, 'leads.compose_json parses with ok:true').toBe(true);
  expect(String(draft.headline || '').length, 'composed headline').toBeGreaterThan(10);
  note('lead_row', {
    company: lead.company_name,
    announcement: lead.announcement_type,
    furthest_step: lead.furthest_step,
    draft_headline: draft.headline,
    draft_paragraphs: Array.isArray(draft.body) ? draft.body.length : null,
  });

  const runs = await q(
    'SELECT id, ok, error, http_status, duration_ms FROM compose_runs WHERE lead_id = $1 ORDER BY request_at DESC',
    [leadId],
  );
  expect(runs.length, 'compose_runs row').toBeGreaterThan(0);
  expect(runs[0].ok, 'compose_runs.ok').toBe(true);
  note('compose_run', {
    id: runs[0].id,
    ok: runs[0].ok,
    duration_ms: runs[0].duration_ms,
    rows: runs.length,
  });

  const draftEmail = await waitForEmail(EMAIL, /press release draft is ready/, { timeout: 120000 })
    .catch((err) => ({ error: err.message }));
  note('draft_ready_email', draftEmail.id ? { id: draftEmail.id, last_event: draftEmail.last_event } : draftEmail);

  /* ---------- 7. read it, approve it ---------- */
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Read it before you decide.');
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/\w/);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve this release' }).click();
  await expect(page.getByText('Release approved')).toBeVisible();

  const approvals = await q(
    'SELECT id, lead_id, order_id, approver_email, checkbox_version, approved_at FROM approvals WHERE lead_id = $1',
    [leadId],
  );
  expect(approvals.length, 'approvals row').toBe(1);
  expect(approvals[0].approver_email).toBe(EMAIL);
  note('approval_row', { id: approvals[0].id, version: approvals[0].checkbox_version });

  const approvedEmail = await waitForEmail(EMAIL, /You approved your Mindscale Echo press release/, {
    timeout: 120000,
  }).catch((err) => ({ error: err.message }));
  note('approved_email', approvedEmail.id ? { id: approvedEmail.id, last_event: approvedEmail.last_event } : approvedEmail);

  /* ---------- 8. pay ---------- */
  await page.getByRole('button', { name: /^Send it out$/ }).click();
  await page.waitForURL(/\/checkout\?token=/, { timeout: 60000 });
  await page.getByRole('button', { name: new RegExp(`Send it out — \\${PLAN.priceLabel}`) }).click();

  await payWithTestCard(page);
  await page.waitForURL(/\/account/, { timeout: 180000 });
  const accountUrl = new URL(page.url());
  const sessionId = accountUrl.searchParams.get('session_id');
  expect(sessionId, 'Stripe session id on the return URL').toMatch(/^cs_test_/);
  note('checkout_session', sessionId);

  const stripeSession = await stripeApi(`/checkout/sessions/${sessionId}`);
  expect(stripeSession.payment_status, 'Stripe payment_status').toBe('paid');
  expect(stripeSession.amount_total, 'Stripe amount_total').toBe(PLAN.cents);
  expect(stripeSession.livemode, 'must be test mode').toBe(false);
  note('stripe_session', {
    id: stripeSession.id,
    payment_status: stripeSession.payment_status,
    amount_total: stripeSession.amount_total,
    customer: stripeSession.customer,
    payment_intent: stripeSession.payment_intent,
  });

  /* ---------- 9. the webhook writes the order ---------- */
  const order = await waitFor(
    'orders row from the Stripe webhook',
    async () => {
      const [row] = await q(
        'SELECT id, email, plan, amount_cents, payment_status, order_status, paid_at, brief_submitted_at, confirmation_email_sent_at, lead_id, compose_run_id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id FROM orders WHERE stripe_session_id = $1',
        [sessionId],
      );
      return row && row.payment_status === 'paid' && row.confirmation_email_sent_at ? row : null;
    },
    { timeout: 240000, interval: 4000 },
  );
  expect(order.email).toBe(EMAIL);
  expect(order.plan).toBe(PLAN.id);
  expect(order.amount_cents, 'order amount').toBe(PLAN.cents);
  expect(order.payment_status).toBe('paid');
  expect(order.confirmation_email_sent_at, 'confirmation_email_sent_at').toBeTruthy();
  expect(order.lead_id, 'order is linked to the lead').toBe(leadId);
  expect(order.brief_submitted_at, 'brief copied onto the paid order').toBeTruthy();
  note('order_row', {
    id: order.id,
    plan: order.plan,
    amount_cents: order.amount_cents,
    payment_status: order.payment_status,
    order_status: order.order_status,
    compose_run_id: order.compose_run_id,
  });

  const paidLead = await waitFor(
    'lead promoted to approved after payment',
    async () => {
      const [row] = await q('SELECT order_status FROM leads WHERE id = $1', [leadId]);
      return row && ['approved', 'paid', 'pr_sent'].includes(row.order_status) ? row : null;
    },
    { timeout: 120000 },
  );
  note('lead_status_after_payment', paidLead.order_status);

  const confirmation = await waitForEmail(EMAIL, /payment succeeded/, { timeout: 180000 });
  const confirmationBody = await resendEmail(confirmation.id);
  expect(confirmationBody.subject).toContain(`Mindscale Echo ${PLAN.label} payment succeeded`);
  expect(confirmationBody.text || '', 'confirmation is not a magic link').not.toMatch(
    /auth\/callback\?token=/,
  );
  note('confirmation_email', {
    id: confirmation.id,
    subject: confirmation.subject,
    last_event: confirmation.last_event,
  });

  /* ---------- 10. the workspace tells the truth ---------- */
  await page.goto('/account');
  await expect(page.getByText('Paid').first()).toBeVisible();
  await expect(page.getByText(/Brief received/).first()).toBeVisible();
  await expect(page.getByText('Release approved').first()).toBeVisible();
  await expect(page.locator(`a[href="/preview/${leadId}"]`).first()).toBeVisible();
  const accountText = await page.locator('main').innerText();
  expect(accountText).toContain(COMPANY);
  note('account_page', {
    paid: accountText.includes('Paid'),
    brief_received: /Brief received/.test(accountText),
    approved: accountText.includes('Release approved'),
    draft_link: `/preview/${leadId}`,
  });

  /* ---------- 11. the owner submits it to the vendor ---------- */
  const prSent = await page.request.post('/api/admin/pr-sent', {
    headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
    data: { leadId, orderId: order.id },
  });
  const prSentJson = await prSent.json();
  expect(prSent.status(), 'POST /api/admin/pr-sent').toBe(200);
  expect(prSentJson).toMatchObject({ ok: true, orderStatus: 'pr_sent' });
  note('pr_sent_response', prSentJson);

  const [leadAfter] = await q('SELECT order_status FROM leads WHERE id = $1', [leadId]);
  const [orderAfter] = await q('SELECT order_status, pr_sent_at FROM orders WHERE id = $1', [order.id]);
  expect(leadAfter.order_status).toBe('pr_sent');
  expect(orderAfter.order_status).toBe('pr_sent');
  expect(orderAfter.pr_sent_at).toBeTruthy();

  const history = await q(
    'SELECT from_status, to_status, actor, created_at FROM status_history WHERE lead_id = $1 ORDER BY created_at',
    [leadId],
  );
  expect(history.some((h) => h.to_status === 'pr_sent' && h.actor === 'owner'), 'status_history pr_sent row').toBe(true);
  note('status_history', history.map((h) => `${h.from_status || '∅'}→${h.to_status}(${h.actor})`));

  const sentEmail = await waitForEmail(EMAIL, /press release has been submitted/, { timeout: 180000 });
  note('pr_sent_email', { id: sentEmail.id, subject: sentEmail.subject, last_event: sentEmail.last_event });

  /* ---------- done ---------- */
  evidence.finishedAt = new Date().toISOString();
  evidence.leadId = leadId;
  evidence.orderId = order.id;
  evidence.composeRunId = runs[0].id;
  evidence.stripeSessionId = sessionId;
  mkdirSync('test-results', { recursive: true });
  const host = new URL(evidence.baseURL).host.replace(/[^a-z0-9]+/gi, '-');
  const file = `test-results/walk-${host}-${identity.n}.json`;
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(`[walk] evidence written to ${file}`);
});

test.afterAll(async () => {
  if (process.env.KEEP_TEST_DATA === '1') {
    console.log('[walk] KEEP_TEST_DATA=1 — leaving the test rows in place');
    return;
  }
  const deleted = await cleanupTestIdentity(EMAIL);
  console.log('[walk] cleanup:', JSON.stringify(deleted));
  const after = await countsForTestIdentity(EMAIL);
  console.log('[walk] remaining rows for the test identity:', JSON.stringify(after));
});
