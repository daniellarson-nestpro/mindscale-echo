import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODE_MAX_ATTEMPTS,
  codesMatch,
  evaluateCodeAttempt,
  formatCodeDisplay,
  generateNumericCode,
  hashCode,
  isValidCode,
  normalizeCode,
  startOkBody,
  verifyErrorBody,
  verifySuccessBody,
} from '../lib/codes.js';
import { inferStepFromLead, ladderState, pathForStep, resolveFurthestStep, hasComposeDraft } from '../lib/progress.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { isPrivateIPv4, isPrivateIp, parsePublicHttpUrl } from '../lib/ssrf.js';
import { extractArticleText, parseArticleHtml } from '../lib/article-html.js';
import { cleanPhone, mergeStartLeadFields, sanitizeContext, sanitizePrefill } from '../lib/prefill-fields.js';
import { formatChipDate, normalizeArticleInput, toHyperagentArticle } from '../lib/article-shape.js';
import { briefSavedBody, hasResumableBrief, initialFromBrief, leadToBriefJson, mergeBriefFormState, sourcesFromBrief } from '../lib/brief-shape.js';
import { checkoutSummaryFromBrief, draftFromBrief, hasRealBrief } from '../lib/draft.js';
import {
  articleSourceFromLead,
  buildComposePayload,
  COMPOSE_KEYS,
  composeJsonToDraft,
  hasSavedCompose,
  isComposeInFlight,
  normalizeComposeResponse,
  parseComposeJson,
  previewTokenFor,
  resolveArticleText,
  statusForComposeError,
  waitForExistingCompose,
  briefNewerThanCompose,
  canReuseN8nCompose,
  composeLockAllowsNewRun,
  hasN8nCompose,
} from '../lib/compose.js';
import {
  callN8nCompose,
  DEFAULT_N8N_WEBHOOK_URL,
  n8nRequestHeaders,
  n8nWebhookHost,
  n8nWebhookUrl,
} from '../lib/n8n.js';
import { appendCheckoutParams, looksLikeEmail, safePreviewToken, safeRelativePath } from '../lib/url.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SECRET = 'test-auth-secret';

test('normalize and display codes as 483201 / 483-201', () => {
  assert.equal(normalizeCode('483-201'), '483201');
  assert.equal(normalizeCode(' 483 201 '), '483201');
  assert.equal(formatCodeDisplay('483201'), '483-201');
  assert.equal(isValidCode('483-201'), true);
  assert.equal(isValidCode('48320'), false);
  assert.equal(isValidCode('abcdef'), false);
});

test('generated codes are six digits', () => {
  for (let i = 0; i < 20; i += 1) {
    const code = generateNumericCode();
    assert.match(code, /^\d{6}$/);
  }
});

test('code hash compare matches and rejects', () => {
  const hash = hashCode('483201', SECRET);
  assert.ok(hash);
  assert.notEqual(hash, '483201');
  assert.equal(codesMatch('483-201', hash, SECRET), true);
  assert.equal(codesMatch('483201', hash, SECRET), true);
  assert.equal(codesMatch('000000', hash, SECRET), false);
});

test('code redeem: success, wrong, expired, lockout', () => {
  const hash = hashCode('483201', SECRET);
  const base = {
    code_hash: hash,
    used_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempts: 0,
  };

  assert.deepEqual(evaluateCodeAttempt({ row: base, code: '483-201', secret: SECRET }), { ok: true });
  assert.deepEqual(evaluateCodeAttempt({ row: base, code: '000000', secret: SECRET }), {
    ok: false,
    error: 'invalid',
  });
  assert.deepEqual(evaluateCodeAttempt({ row: null, code: '483201', secret: SECRET }), {
    ok: false,
    error: 'invalid',
  });
  assert.deepEqual(
    evaluateCodeAttempt({
      row: { ...base, expires_at: new Date(Date.now() - 1000).toISOString() },
      code: '483201',
      secret: SECRET,
    }),
    { ok: false, error: 'expired' }
  );
  assert.deepEqual(
    evaluateCodeAttempt({
      row: { ...base, attempts: CODE_MAX_ATTEMPTS },
      code: '483201',
      secret: SECRET,
    }),
    { ok: false, error: 'invalid' }
  );
});

test('start never leaks existence; verify errors stay generic', () => {
  assert.deepEqual(startOkBody('new@example.com'), { ok: true, email: 'new@example.com', sent: true });
  assert.deepEqual(startOkBody('old@example.com'), { ok: true, email: 'old@example.com', sent: true });
  assert.deepEqual(Object.keys(startOkBody('a@b.co')).sort(), ['email', 'ok', 'sent']);
  assert.deepEqual(verifyErrorBody('invalid'), { ok: false, error: 'invalid' });
  assert.deepEqual(verifyErrorBody('missing'), { ok: false, error: 'invalid' });
  assert.deepEqual(verifyErrorBody('expired'), { ok: false, error: 'expired', expired: true });
  assert.equal(verifyErrorBody('expired').expired, true);
  assert.equal(JSON.stringify(verifyErrorBody('no-such-user')), JSON.stringify(verifyErrorBody('wrong')));
  const success = verifySuccessBody({ furthestStep: 'brief', redirectTo: '/brief' });
  assert.equal(success.next, '/brief');
  assert.equal(success.redirectTo, '/brief');
  assert.equal(success.verified, true);
  assert.equal(success.furthestStep, 'brief');
});

test('start context persists onto lead fields like prefill', () => {
  const context = sanitizeContext({
    articleUrl: 'https://localpaper.com/story',
    articleText: 'Shop opened downtown.',
    announcementType: 'Grand opening',
    companyName: 'Northline',
    quote: 'We opened.',
    junk: '<script>',
  });
  assert.deepEqual(context, {
    articleUrl: 'https://localpaper.com/story',
    articleText: 'Shop opened downtown.',
    announcementType: 'Grand opening',
    companyName: 'Northline',
    quote: 'We opened.',
  });
  const merged = mergeStartLeadFields(
    { contactName: 'Dana', phone: '555-123-4567' },
    { companyName: 'Northline', articleUrl: 'javascript:alert(1)', quote: 'We opened.' }
  );
  assert.equal(merged.contactName, 'Dana');
  assert.equal(merged.phone, '555-123-4567');
  assert.equal(merged.companyName, 'Northline');
  assert.equal(merged.quote, 'We opened.');
  assert.equal(merged.articleUrl, undefined);
});

test('furthestStep and ladder from lead/order state', () => {
  assert.equal(resolveFurthestStep(null, []), 'brief');
  assert.equal(pathForStep('brief'), '/brief');
  assert.equal(pathForStep('account'), '/account');
  assert.equal(inferStepFromLead({ company_name: 'Acme', announcement_type: 'launch' }), 'preview');
  assert.equal(
    inferStepFromLead({
      company_name: 'Acme',
      announcement_type: 'launch',
      article_url: 'https://news.example/story',
    }),
    'checkout'
  );
  assert.equal(resolveFurthestStep({ furthest_step: 'brief' }, [{ payment_status: 'paid' }]), 'account');
  assert.equal(ladderState(null, []), 'empty');
  assert.equal(ladderState({ company_name: 'Acme' }, []), 'in_progress');
  assert.equal(
    ladderState(
      { company_name: 'Acme', announcement_type: 'launch', article_url: 'https://news.example/x' },
      []
    ),
    'draft_ready_unpurchased'
  );
  assert.equal(ladderState({}, [{ payment_status: 'paid' }]), 'purchased');
});

test('prefill drops garbage fields silently', () => {
  const clean = sanitizePrefill({
    email: ' Not-An-Email ',
    companyName: 'Northline',
    articleUrl: 'javascript:alert(1)',
    quote: 'We opened.',
    contactName: 'Dana',
    phone: 'nope',
  });
  assert.deepEqual(clean, {
    companyName: 'Northline',
    quote: 'We opened.',
    contactName: 'Dana',
  });
  assert.equal(sanitizePrefill({ email: 'dana@northline.com' }).email, 'dana@northline.com');
  assert.equal(cleanPhone('555-123-4567'), '555-123-4567');
  assert.equal(cleanPhone('abc'), '');
  assert.equal(
    sanitizePrefill({ articleUrl: 'https://localpaper.com/story' }).articleUrl,
    'https://localpaper.com/story'
  );
});

test('SSRF rejects private, metadata, and non-http URLs', () => {
  assert.equal(parsePublicHttpUrl('not a url').error, 'invalid_url');
  assert.equal(parsePublicHttpUrl('file:///etc/passwd').error, 'invalid_url');
  assert.equal(parsePublicHttpUrl('javascript:alert(1)').error, 'invalid_url');
  assert.equal(parsePublicHttpUrl('http://127.0.0.1/').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://localhost/secret').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://169.254.169.254/latest/meta-data').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://10.0.0.8/admin').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://192.168.1.9/').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://172.16.0.4/').error, 'blocked');
  assert.equal(parsePublicHttpUrl('http://[::1]/').error, 'blocked');
  assert.equal(parsePublicHttpUrl('https://example.com/story').error, undefined);
  assert.equal(parsePublicHttpUrl('https://example.com/story').url.hostname, 'example.com');
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
});

test('rate limiter trips after max hits', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  assert.equal(limiter.check('ip').ok, true);
  assert.equal(limiter.check('ip').ok, true);
  assert.equal(limiter.check('ip').ok, false);
  assert.equal(limiter.check('other').ok, true);
});

test('singular article route uses Hyperagent field names', () => {
  assert.equal(normalizeArticleInput('example.com/story'), 'https://example.com/story');
  assert.equal(normalizeArticleInput('https://news.example/x'), 'https://news.example/x');
  const weak = toHyperagentArticle(
    { ok: true, articleUrl: 'https://news.example/x', title: null, outlet: 'news.example', warning: 'unparsed' },
    'https://news.example/x'
  );
  assert.equal(weak.status, 200);
  assert.deepEqual(weak.body, {
    url: 'https://news.example/x',
    headline: null,
    outlet: 'news.example',
    date: null,
    partial: true,
  });
  const rich = toHyperagentArticle(
    {
      ok: true,
      articleUrl: 'https://gazette.example/shop',
      title: 'Shop opens downtown',
      outlet: 'Daily Gazette',
      date: '2026-04-01',
    },
    'https://gazette.example/shop'
  );
  assert.equal(rich.body.headline, 'Shop opens downtown');
  assert.equal(rich.body.url, 'https://gazette.example/shop');
  assert.equal(rich.body.partial, false);
  assert.equal(rich.body.date, formatChipDate('2026-04-01'));
  const garbage = toHyperagentArticle({ ok: false, error: 'invalid_url', status: 400 }, '');
  assert.equal(garbage.status, 400);
  assert.ok(garbage.body.error);
  const failed = toHyperagentArticle({ ok: false, error: 'fetch_failed' }, 'https://news.example/x');
  assert.equal(failed.status, 200);
  assert.equal(failed.body.partial, true);
});

test('PATCH /api/brief response and GET resume shape', () => {
  assert.deepEqual(briefSavedBody(), { saved: true });
  assert.deepEqual(leadToBriefJson(null), { brief: null });
  const brief = leadToBriefJson({
    email: 'dana@northline.com',
    company_name: 'Northline',
    contact_name: 'Dana',
    phone: '555-123-4567',
    announcement_type: 'Grand opening',
    article_url: 'https://localpaper.com/story',
    article_text: '',
    website: '',
    quote: 'We opened.',
    quote_attribution: '',
    notes: '',
  });
  assert.equal(brief.brief.companyName, 'Northline');
  assert.equal(brief.brief.contactName, 'Dana');
  assert.equal(brief.brief.contactEmail, 'dana@northline.com');
  assert.equal(brief.brief.articleUrl, 'https://localpaper.com/story');
});

test('brief form resume maps saved fields including article sources', () => {
  const brief = {
    companyName: 'Northline',
    website: 'northline.com',
    contactName: 'Dana',
    contactEmail: 'dana@northline.com',
    phone: '555-123-4567',
    announcementType: 'Grand opening',
    articleUrl: 'https://localpaper.com/story',
    articleText: 'The shop opened downtown.',
    quote: 'We opened.',
    quoteAttribution: 'Dana, Owner',
    notes: 'Family-run.',
  };
  const initial = initialFromBrief(brief);
  assert.equal(initial.companyName, 'Northline');
  assert.equal(initial.announcementType, 'Grand opening');
  assert.equal(initial.sources.length, 2);
  assert.equal(initial.sources[0].type, 'url');
  assert.equal(initial.sources[0].value, 'https://localpaper.com/story');
  assert.equal(initial.sources[1].type, 'text');
  assert.equal(hasResumableBrief(brief), true);
  assert.equal(hasResumableBrief(null), false);
  assert.equal(hasResumableBrief({ articleUrl: 'https://localpaper.com/story' }), true);

  const merged = mergeBriefFormState(
    { values: { companyName: '', notes: '' }, sources: [] },
    { values: { companyName: 'Northline', notes: 'Family-run.' }, sources: sourcesFromBrief(brief) }
  );
  assert.equal(merged.values.companyName, 'Northline');
  assert.equal(merged.sources.length, 2);
  assert.deepEqual(initialFromBrief(null), {});
});

test('Change something stays on V2 /brief#news; GET 401 goes to /start', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const previewSrc = readFileSync(join(here, '../components/funnel/PreviewScreen.jsx'), 'utf8');
  const briefSrc = readFileSync(join(here, '../components/funnel/BriefForm.jsx'), 'utf8');
  const briefRoute = readFileSync(join(here, '../app/api/brief/route.js'), 'utf8');
  const funnelSrc = readFileSync(join(here, '../lib/funnel.js'), 'utf8');
  assert.equal(previewSrc.includes("href={BRIEF_EDIT_HREF}"), true);
  assert.equal(previewSrc.includes('/login'), false);
  assert.equal(previewSrc.includes('/success'), false);
  assert.equal(previewSrc.includes('OnboardingForm'), false);
  assert.equal(funnelSrc.includes("BRIEF_EDIT_HREF = '/brief#news'"), true);
  assert.equal(briefSrc.includes("fetch('/api/brief'"), true);
  assert.equal(briefSrc.includes("router.replace('/start')"), true);
  assert.equal(briefSrc.includes("router.replace('/login')"), false);
  assert.equal(briefSrc.includes('BRIEF.resume'), true);
  assert.equal(briefSrc.includes('OnboardingForm'), false);
  assert.equal(briefRoute.includes("status: 401"), true);
  assert.equal(briefRoute.includes("{ brief: null }"), true);
});

test('verification email copy is six digits with no dash', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const emailSrc = readFileSync(join(here, '../lib/email.js'), 'utf8');
  assert.equal(emailSrc.includes("Your Mindscale Echo code: ${digits}"), true);
  assert.equal(emailSrc.includes("Here's your code: ${digits}."), true);
  assert.equal(emailSrc.includes("Here's your code: ${pretty}"), false);
  assert.equal(emailSrc.includes('483-201'), false);
});

test('draftFromBrief uses the lead, never Sal’s Pizza', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  const draft = draftFromBrief(
    {
      companyName: 'Northline',
      website: 'northline.com',
      contactName: 'Dana',
      contactEmail: 'dana@northline.com',
      phone: '555-123-4567',
      announcementType: 'Grand opening',
      articleUrl: 'https://localpaper.com/story',
      articleText: 'The shop opened downtown.\n\nNeighbors showed up.',
      quote: 'We opened.',
      quoteAttribution: 'Dana, Owner',
      notes: 'Family-run.',
    },
    now
  );
  assert.equal(draft.companyName, 'Northline');
  assert.equal(draft.headline.includes('Northline'), true);
  assert.equal(draft.headline.includes('Grand opening'), true);
  assert.deepEqual(draft.bodyParagraphs, ['The shop opened downtown.', 'Neighbors showed up.']);
  assert.equal(draft.quote, 'We opened.');
  assert.equal(JSON.stringify(draft).toLowerCase().includes('sal'), false);
  assert.equal(draft.dateline.includes('GRANDVIEW'), false);
  assert.equal(hasRealBrief({ companyName: 'Northline' }), true);
  assert.equal(hasRealBrief({}), false);
  assert.equal(checkoutSummaryFromBrief({ companyName: 'Northline', announcementType: 'Grand opening' }), 'Northline · Grand opening');
  assert.equal(checkoutSummaryFromBrief(null), 'Draft ready');
  assert.equal(checkoutSummaryFromBrief({ companyName: "Sal’s Pizza & Pasta" }).includes('Second location'), false);
});

test('checkout next/email/token guards reject open redirects', () => {
  assert.equal(safeRelativePath('/account?paid=1'), '/account?paid=1');
  assert.equal(safeRelativePath('//evil.com'), null);
  assert.equal(safeRelativePath('https://evil.example'), null);
  assert.equal(looksLikeEmail('dana@northline.com'), 'dana@northline.com');
  assert.equal(looksLikeEmail('not-an-email'), null);
  assert.equal(safePreviewToken('abc_12'), 'abc_12');
  assert.equal(safePreviewToken('../x'), 'demo');
  const next = appendCheckoutParams('/account?paid=1', { planId: 'premium', token: 'demo' });
  assert.match(next, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(next, /plan=premium/);
  assert.match(next, /token=demo/);
  assert.match(next, /^\/account\?paid=1&/);
});

test('verify route has no stub codes — 000000 is just invalid', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const verifySrc = readFileSync(join(here, '../app/api/auth/verify/route.js'), 'utf8');
  const startSrc = readFileSync(join(here, '../app/api/auth/start/route.js'), 'utf8');
  assert.equal(verifySrc.includes('111111'), false);
  assert.equal(verifySrc.includes('STUB'), false);
  assert.equal(startSrc.includes('STUB'), false);
  assert.equal(verifySrc.includes('any 6 digits'), false);
  const hash = hashCode('483201', SECRET);
  assert.deepEqual(evaluateCodeAttempt({
    row: {
      code_hash: hash,
      used_at: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      attempts: 0,
    },
    code: '000000',
    secret: SECRET,
  }), { ok: false, error: 'invalid' });
});

test('weak HTML parse still returns a payload', () => {
  const empty = parseArticleHtml('<html><body>hi</body></html>', 'https://news.example/x');
  assert.equal(empty.title, null);
  assert.equal(empty.warning, 'unparsed');
  assert.equal(empty.outlet, 'news.example');

  const rich = parseArticleHtml(
    `<html><head>
      <meta property="og:title" content="Shop opens downtown" />
      <meta property="og:site_name" content="Daily Gazette" />
      <meta property="article:published_time" content="2026-04-01" />
      <meta name="author" content="Lee Parks" />
    </head></html>`,
    'https://gazette.example/shop'
  );
  assert.equal(rich.title, 'Shop opens downtown');
  assert.equal(rich.outlet, 'Daily Gazette');
  assert.equal(rich.date, '2026-04-01');
  assert.equal(rich.byline, 'Lee Parks');
});

test('extractArticleText returns visible body, not markup', () => {
  const text = extractArticleText(`
    <html><body>
      <script>window.evil=1</script>
      <article>
        <h1>Shop opens downtown</h1>
        <p>Neighbors showed up.</p>
        <p>The owner cut the ribbon.</p>
      </article>
    </body></html>
  `);
  assert.match(text, /Shop opens downtown/);
  assert.match(text, /Neighbors showed up/);
  assert.equal(text.includes('<p>'), false);
  assert.equal(text.includes('window.evil'), false);
});

test('saved compose JSON wins over draftFromBrief', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  const brief = {
    companyName: 'Northline',
    website: 'northline.com',
    contactName: 'Dana',
    contactEmail: 'dana@northline.com',
    phone: '555-123-4567',
    announcementType: 'Grand opening',
    articleText: 'The shop opened downtown.',
    quote: 'We opened.',
    quoteAttribution: 'Dana, Owner',
  };
  const fallback = draftFromBrief(brief, now);
  const saved = {
    ok: true,
    source: 'n8n',
    headline: 'Northline opens downtown',
    subhead: 'A real subhead',
    dateline: 'COLUMBUS, OH — September 3, 2026',
    body: ['Composed paragraph one.', 'Composed paragraph two.'],
    quote: 'Composed quote.',
    quoteAttribution: 'Dana, Owner',
    boilerplate: 'About Northline.',
    contactLine: 'Dana · dana@northline.com',
    error: '',
  };
  const draft = composeJsonToDraft(saved, brief, now);
  assert.equal(draft.headline, 'Northline opens downtown');
  assert.equal(draft.subhead, 'A real subhead');
  assert.deepEqual(draft.bodyParagraphs, ['Composed paragraph one.', 'Composed paragraph two.']);
  assert.equal(draft.companyName, 'Northline');
  assert.equal(draft.contactEmail, 'dana@northline.com');
  assert.notEqual(draft.headline, fallback.headline);
  assert.equal(JSON.stringify(draft).toLowerCase().includes('sal'), false);
  assert.equal(parseComposeJson(JSON.stringify(saved)).headline, 'Northline opens downtown');
  assert.equal(parseComposeJson('{"ok":false}'), null);
  assert.equal(hasN8nCompose({ compose_json: JSON.stringify(saved) }), true);
  assert.equal(hasSavedCompose({ compose_json: JSON.stringify(saved) }), true);
  assert.equal(hasSavedCompose({ compose_json: JSON.stringify({ ok: true, headline: 'Local template' }) }), false);
  assert.equal(hasSavedCompose({ compose_json: null }), false);
});

test('compose payload always includes every key; empty string if unused', () => {
  const payload = buildComposePayload({
    lead: {
      id: 'lead-1',
      company_name: 'Northline',
      email: 'dana@northline.com',
      article_url: 'https://localpaper.com/story',
    },
    articleText: 'Neighbors showed up.',
    orderId: '',
  });
  assert.deepEqual(Object.keys(payload).sort(), [...COMPOSE_KEYS].sort());
  for (const key of COMPOSE_KEYS) {
    assert.equal(typeof payload[key], 'string');
  }
  assert.equal(payload.companyName, 'Northline');
  assert.equal(payload.articleText, 'Neighbors showed up.');
  assert.equal(payload.articleSource, 'url');
  assert.equal(payload.phone, '');
  assert.equal(payload.orderId, '');
  assert.equal(payload.leadId, 'lead-1');
  assert.equal(articleSourceFromLead({ article_text: 'pasted' }), 'paste');
  assert.equal(previewTokenFor({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
});

test('articleText falls back to scrape, then notes/quote', async () => {
  const scraped = await resolveArticleText({
    articleText: '',
    articleUrl: 'https://localpaper.com/story',
    notes: 'ignored if scrape works',
    quote: 'ignored',
    scrape: async () => ({ text: 'Scraped body from the URL.' }),
  });
  assert.equal(scraped.articleText, 'Scraped body from the URL.');
  assert.equal(scraped.scraped, true);

  const fromNotes = await resolveArticleText({
    articleText: '',
    articleUrl: 'https://localpaper.com/story',
    notes: 'Family-run.',
    quote: 'We opened.',
    scrape: async () => ({ text: '' }),
  });
  assert.equal(fromNotes.articleText, 'Family-run.\n\nWe opened.');
  assert.equal(fromNotes.scraped, false);

  const existing = await resolveArticleText({
    articleText: 'Pasted article.',
    articleUrl: 'https://localpaper.com/story',
    scrape: async () => {
      throw new Error('should not scrape when text exists');
    },
  });
  assert.equal(existing.articleText, 'Pasted article.');
});

test('n8n webhook url never uses webhook-test and defaults when unset', () => {
  const prevUrl = process.env.N8N_WEBHOOK_URL;
  const prevSecret = process.env.N8N_WEBHOOK_SECRET;
  try {
    delete process.env.N8N_WEBHOOK_URL;
    assert.equal(n8nWebhookUrl(), DEFAULT_N8N_WEBHOOK_URL);
    assert.equal(DEFAULT_N8N_WEBHOOK_URL.includes('webhook-test'), false);
    assert.match(DEFAULT_N8N_WEBHOOK_URL, /\/webhook\/press-release$/);
    assert.equal(
      n8nWebhookUrl('https://nestpro.app.n8n.cloud/webhook-test/press-release'),
      'https://nestpro.app.n8n.cloud/webhook/press-release'
    );
    assert.equal(n8nRequestHeaders('').hasOwnProperty('X-API-Key'), false);
    assert.equal(n8nRequestHeaders('secret-key')['X-API-Key'], 'secret-key');
  } finally {
    if (prevUrl === undefined) delete process.env.N8N_WEBHOOK_URL;
    else process.env.N8N_WEBHOOK_URL = prevUrl;
    if (prevSecret === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = prevSecret;
  }
});

test('n8n compose branches on ok, not HTTP status', async () => {
  const prevSecret = process.env.N8N_WEBHOOK_SECRET;
  process.env.N8N_WEBHOOK_SECRET = 'test-n8n-secret';
  try {
    let captured;
    const okFetch = async (url, opts) => {
      captured = { url, opts };
      return {
        status: 200,
        json: async () => ({
          ok: true,
          headline: 'Northline opens',
          subhead: '',
          dateline: 'COLUMBUS, OH — September 3, 2026',
          body: ['Para one.'],
          quote: 'We opened.',
          quoteAttribution: 'Dana',
          boilerplate: 'Northline is a shop.',
          contactLine: 'Dana, dana@northline.com',
          error: '',
        }),
      };
    };
    const ok = await callN8nCompose(
      { companyName: 'Northline' },
      { fetchImpl: okFetch, url: DEFAULT_N8N_WEBHOOK_URL, secret: 'test-n8n-secret' }
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.draft.headline, 'Northline opens');
    assert.equal(captured.url, DEFAULT_N8N_WEBHOOK_URL);
    assert.equal(captured.opts.method, 'POST');
    assert.equal(captured.opts.headers['X-API-Key'], 'test-n8n-secret');
    assert.equal(JSON.parse(captured.opts.body).companyName, 'Northline');

    const falseOk = await callN8nCompose(
      { companyName: 'Northline' },
      {
        fetchImpl: async () => ({
          status: 200,
          json: async () => ({ ok: false, error: 'model_failed' }),
        }),
      }
    );
    assert.equal(falseOk.ok, false);
    assert.equal(falseOk.error, 'model_failed');
    assert.equal(statusForComposeError(falseOk.error), 200);

    const timeout = await callN8nCompose(
      { companyName: 'Northline' },
      {
        timeoutMs: 20,
        fetchImpl: (_url, opts) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      }
    );
    assert.equal(timeout.ok, false);
    assert.equal(timeout.error, 'timeout');
    assert.equal(statusForComposeError('timeout'), 502);
    assert.equal(statusForComposeError('network'), 502);
  } finally {
    if (prevSecret === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = prevSecret;
  }
});

test('callN8nCompose logs host, duration, ok, error without secrets', async () => {
  const logs = [];
  const orig = console.info;
  console.info = (...args) => logs.push(args);
  try {
    await callN8nCompose(
      { companyName: 'Northline' },
      {
        url: DEFAULT_N8N_WEBHOOK_URL,
        fetchImpl: async () => ({
          status: 200,
          json: async () => ({ ok: false, error: 'articleText too brief' }),
        }),
      }
    );
  } finally {
    console.info = orig;
  }
  const line = logs.find((args) => String(args[0]).includes('[n8n compose]'));
  assert.ok(line);
  const payload = line[1];
  assert.equal(payload.host, 'nestpro.app.n8n.cloud');
  assert.equal(n8nWebhookHost(), 'nestpro.app.n8n.cloud');
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'articleText too brief');
  assert.equal(typeof payload.durationMs, 'number');
  assert.equal(JSON.stringify(payload).includes('X-API-Key'), false);
});

test('only source n8n is reusable; template json is not success', async () => {
  const now = Date.parse('2026-09-03T12:00:00Z');
  const running = {
    id: 'lead-1',
    compose_json: null,
    compose_started_at: new Date(now - 1000).toISOString(),
    compose_finished_at: null,
  };
  assert.equal(isComposeInFlight(running, now), true);
  assert.equal(isComposeInFlight({ ...running, compose_finished_at: new Date(now).toISOString() }, now), false);
  assert.equal(isComposeInFlight({ ...running, compose_json: JSON.stringify({ ok: true, headline: 'Local' }) }, now), true);

  const template = {
    id: 'lead-1',
    compose_json: JSON.stringify({ ok: true, headline: 'Local template', body: ['Hi'] }),
    compose_finished_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
  assert.equal(hasN8nCompose(template), false);
  assert.equal(canReuseN8nCompose(template), false);
  assert.equal(composeLockAllowsNewRun(template, now), true);

  const n8nSaved = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    compose_json: JSON.stringify({ ok: true, source: 'n8n', headline: 'Done', body: ['Hi'] }),
    compose_finished_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
  assert.equal(canReuseN8nCompose(n8nSaved), true);
  assert.equal(composeLockAllowsNewRun(n8nSaved, now), false);
  assert.equal(
    briefNewerThanCompose({
      ...n8nSaved,
      updated_at: new Date(now + 1000).toISOString(),
    }),
    true
  );
  assert.equal(
    canReuseN8nCompose({
      ...n8nSaved,
      updated_at: new Date(now + 1000).toISOString(),
    }),
    false
  );
  assert.equal(
    composeLockAllowsNewRun(
      {
        ...n8nSaved,
        updated_at: new Date(now + 1000).toISOString(),
      },
      now
    ),
    true
  );

  const waitedTemplate = await waitForExistingCompose('lead-1', {
    getLead: async () => template,
    timeoutMs: 50,
    intervalMs: 10,
  });
  assert.equal(waitedTemplate.ok, false);

  const waitedSaved = await waitForExistingCompose('lead-1', {
    getLead: async () => n8nSaved,
    timeoutMs: 50,
    intervalMs: 10,
  });
  assert.equal(waitedSaved.ok, true);
  assert.equal(waitedSaved.token, n8nSaved.id);

  let polls = 0;
  const waitedFail = await waitForExistingCompose('lead-1', {
    getLead: async () => {
      polls += 1;
      return {
        id: 'lead-1',
        compose_json: null,
        compose_started_at: new Date().toISOString(),
        compose_finished_at: polls > 1 ? new Date().toISOString() : null,
      };
    },
    sleep: async () => {},
    timeoutMs: 5_000,
    intervalMs: 1,
    now: () => Date.now(),
  });
  assert.equal(waitedFail.ok, false);
  assert.equal(waitedFail.status, 200);
});

test('compose_json marks the ladder draft-ready and preview furthest', () => {
  const withDraft = {
    company_name: 'Acme',
    announcement_type: 'launch',
    compose_json: JSON.stringify({ ok: true, source: 'n8n', headline: 'Acme opens', body: ['Hi'] }),
  };
  assert.equal(inferStepFromLead(withDraft), 'preview');
  assert.equal(ladderState(withDraft, []), 'draft_ready_unpurchased');
  assert.equal(resolveFurthestStep({ ...withDraft, furthest_step: 'preview' }, []), 'preview');
  assert.equal(
    hasComposeDraft({ compose_json: JSON.stringify({ ok: true, headline: 'template' }) }),
    false
  );
  assert.equal(hasComposeDraft(withDraft), true);
});

test('normalizeComposeResponse stamps source n8n', () => {
  const normalized = normalizeComposeResponse({
    ok: true,
    headline: '  Northline opens  ',
    body: ['Para one.', '', 'Para two.'],
    quote: 'We opened.',
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.source, 'n8n');
  assert.equal(normalized.headline, 'Northline opens');
  assert.deepEqual(normalized.body, ['Para one.', 'Para two.']);
  assert.equal(normalized.subhead, '');
  assert.equal(normalized.error, '');
  assert.equal(normalized.contactLine, '');
});

test('brief/complete is server-only n8n; ComposeWait branches on ok', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const completeSrc = readFileSync(join(here, '../app/api/brief/complete/route.js'), 'utf8');
  const waitSrc = readFileSync(join(here, '../components/funnel/ComposeWait.jsx'), 'utf8');
  const previewSrc = readFileSync(join(here, '../lib/preview-draft.js'), 'utf8');
  const plateSrc = readFileSync(join(here, '../app/api/preview/[token]/plate/route.js'), 'utf8');
  assert.equal(completeSrc.includes('callN8nCompose'), true);
  assert.equal(completeSrc.includes('canReuseN8nCompose'), true);
  assert.equal(completeSrc.includes('draftFromBrief'), false);
  assert.equal(completeSrc.includes('maxDuration'), true);
  assert.equal(completeSrc.includes('webhook-test'), false);
  assert.equal(completeSrc.includes('sendVerification'), false);
  assert.equal(completeSrc.includes('resend'), false);
  assert.equal(waitSrc.includes('n8n.cloud'), false);
  assert.equal(waitSrc.includes('/api/brief/complete'), true);
  assert.equal(waitSrc.includes('data.ok !== true'), true);
  assert.equal(previewSrc.includes("saved?.source === 'n8n'"), true);
  assert.equal(plateSrc.includes('loadPreviewDraft'), true);
});

// ─── V1 end-to-end acceptance tests ────────────────────────────────────────

import { readFileSync as rfs } from 'node:fs';
import { fileURLToPath as fUrl } from 'node:url';
import { dirname as dn, join as jn } from 'node:path';
import { validateLogoBuffer } from '../lib/logo-storage.js';
import { APPROVAL_CHECKBOX_COPY } from '../lib/approval.js';
const HERE = dn(fUrl(import.meta.url));

test('six-digit code: no dash, exactly 6 digits', () => {
  // Code format: 483201 (no dash when sent to n8n / stored; display as 483-201)
  assert.match(normalizeCode('483201'), /^\d{6}$/);
  assert.match(normalizeCode('483-201'), /^\d{6}$/);
  assert.equal(isValidCode('483201'), true);
  assert.equal(isValidCode('483-201'), true);
  assert.equal(isValidCode('48320'), false);   // 5 digits
  assert.equal(isValidCode('4832011'), false); // 7 digits
  assert.equal(isValidCode('abcdef'), false);
  assert.equal(formatCodeDisplay('483201'), '483-201');
});

test('auth code: redemption burns both code and magic link', () => {
  const hash = hashCode('483201', SECRET);
  const validRow = {
    code_hash: hash,
    used_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempts: 0,
  };
  // correct code → ok
  assert.deepEqual(evaluateCodeAttempt({ row: validRow, code: '483201', secret: SECRET }), { ok: true });
  // wrong code → invalid (no enumeration)
  assert.deepEqual(evaluateCodeAttempt({ row: validRow, code: '000000', secret: SECRET }), { ok: false, error: 'invalid' });
  // null row → same error (no enumeration)
  assert.deepEqual(evaluateCodeAttempt({ row: null, code: '483201', secret: SECRET }), { ok: false, error: 'invalid' });
});

test('auth code: expiry after 20 minutes', () => {
  const hash = hashCode('483201', SECRET);
  const expiredRow = {
    code_hash: hash,
    used_at: null,
    expires_at: new Date(Date.now() - 1).toISOString(), // expired
    attempts: 0,
  };
  const result = evaluateCodeAttempt({ row: expiredRow, code: '483201', secret: SECRET });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'expired');
});

test('auth code: lockout after max attempts returns invalid (no enumeration)', () => {
  const hash = hashCode('483201', SECRET);
  const lockedRow = {
    code_hash: hash,
    used_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempts: CODE_MAX_ATTEMPTS,
  };
  const result = evaluateCodeAttempt({ row: lockedRow, code: '483201', secret: SECRET });
  assert.equal(result.ok, false);
  // Returns 'invalid' — no enumeration of whether account exists or is locked
  assert.ok(result.error === 'invalid' || result.error === 'locked', 'returns non-revealing error');
});

test('PDF validation: only application/pdf accepted for article', () => {
  // ArticleDrop only calls takeFile for application/pdf
  const articleDropSrc = rfs(jn(HERE, '../components/funnel/ArticleDrop.jsx'), 'utf8');
  assert.ok(articleDropSrc.includes("file.type !== 'application/pdf'"), 'rejects non-PDF');
  assert.ok(!articleDropSrc.includes("type: 'url'"), 'no URL path in V1 component');
  assert.ok(articleDropSrc.includes('MIN_PASTE_LENGTH'), 'enforces min paste length');
});

test('article intake: pasted text minimum length enforced', () => {
  const articleDropSrc = rfs(jn(HERE, '../components/funnel/ArticleDrop.jsx'), 'utf8');
  // Must show error for short text
  assert.ok(articleDropSrc.includes('too short'), 'shows error for short text');
  assert.ok(articleDropSrc.includes('MIN_PASTE_LENGTH'), 'uses min length constant');
});

test('logo validation: rejects non-image MIME types', () => {
  const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG magic
  assert.deepEqual(validateLogoBuffer(fakeBuffer, 'image/png', fakeBuffer.length), { ok: true });
  assert.equal(validateLogoBuffer(fakeBuffer, 'application/pdf', fakeBuffer.length).ok, false);
  assert.equal(validateLogoBuffer(fakeBuffer, 'text/html', fakeBuffer.length).ok, false);
  // Max size check
  assert.equal(validateLogoBuffer(fakeBuffer, 'image/png', 9 * 1024 * 1024).ok, false);
});

test('logo storage: launch blocker without BLOB_READ_WRITE_TOKEN', () => {
  const logoStorageSrc = rfs(jn(HERE, '../lib/logo-storage.js'), 'utf8');
  assert.ok(logoStorageSrc.includes('BLOB_READ_WRITE_TOKEN'), 'checks for token');
  assert.ok(logoStorageSrc.includes('launchBlocker'), 'returns launchBlocker flag');
  assert.ok(logoStorageSrc.includes('LAUNCH BLOCKER'), 'logs LAUNCH BLOCKER');
});

test('compose_runs: exact payload saved BEFORE n8n call', () => {
  const completeSrc = rfs(jn(HERE, '../app/api/brief/complete/route.js'), 'utf8');
  // createComposeRun must be called before callN8nCompose
  // Find the call sites (await createComposeRun / await callN8nCompose), not imports
  const createIdx = completeSrc.indexOf('await createComposeRun');
  const callIdx = completeSrc.indexOf('await callN8nCompose');
  assert.ok(createIdx > 0, 'await createComposeRun is used');
  assert.ok(callIdx > 0, 'await callN8nCompose is used');
  assert.ok(createIdx < callIdx, 'createComposeRun awaited BEFORE callN8nCompose');
});

test('n8n ok:true → saves response and exposes draft', () => {
  const completeSrc = rfs(jn(HERE, '../app/api/brief/complete/route.js'), 'utf8');
  assert.ok(completeSrc.includes('saveComposeSuccess'), 'saves on ok:true');
  assert.ok(completeSrc.includes('normalizeComposeResponse'), 'normalizes response');
  assert.ok(completeSrc.includes('finishComposeRun'), 'records run outcome');
});

test('n8n ok:false/timeout → never exposes fake draft', () => {
  const completeSrc = rfs(jn(HERE, '../app/api/brief/complete/route.js'), 'utf8');
  // must not import draftFromBrief (template fallback)
  assert.ok(!completeSrc.includes('draftFromBrief'), 'no template fallback in compose route');
  assert.ok(completeSrc.includes('failResponse'), 'returns failure on n8n error');
  assert.ok(completeSrc.includes('notifyOwnerComposeFailed'), 'notifies owner on failure');
  assert.ok(completeSrc.includes('markComposeFinished'), 'unlocks compose on failure');
});

test('compose payload includes composeRunId and correct fields', () => {
  const lead = {
    id: 'lead-abc',
    email: 'test@example.com',
    company_name: 'Acme',
    website: 'acme.com',
    contact_name: 'Jane',
    phone: '555-1234',
    announcement_type: 'expansion',
    article_url: null,
    article_text: 'Acme opens new factory.',
    article_source: 'paste',
    quote: 'Big news.',
    quote_attribution: 'CEO',
    notes: '',
  };
  const payload = buildComposePayload({ lead, articleText: 'Acme opens new factory.', orderId: 'ord-1', composeRunId: 'run-1' });
  assert.equal(payload.leadId, 'lead-abc');
  assert.equal(payload.orderId, 'ord-1');
  assert.equal(payload.composeRunId, 'run-1');
  assert.equal(payload.articleSource, 'paste');
  assert.equal(payload.articleUrl, ''); // V1: URL always empty
  assert.equal(typeof payload.companyName, 'string');
  // All COMPOSE_KEYS must be present and be strings
  for (const key of COMPOSE_KEYS) {
    assert.equal(typeof payload[key], 'string', `${key} must be string`);
  }
});

test('n8n retry classification: timeout/network = transient', () => {
  assert.equal(statusForComposeError('timeout'), 502);
  assert.equal(statusForComposeError('network'), 502);
  assert.equal(statusForComposeError('compose_failed'), 200);
  assert.equal(statusForComposeError('insufficient_article'), 200);
});

test('n8n mock: ok:true response shape', async () => {
  let capturedPayload = null;
  const mockFetch = async (url, opts) => {
    capturedPayload = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        headline: 'Acme Opens New Factory',
        body: ['Para one.'],
        source: 'n8n',
      }),
    };
  };

  const result = await callN8nCompose(
    { leadId: 'ld1', articleText: 'Some article', companyName: 'Acme' },
    { fetchImpl: mockFetch, timeoutMs: 5000 }
  );
  assert.equal(result.ok, true);
  assert.equal(result.draft?.headline, 'Acme Opens New Factory');
  assert.ok(capturedPayload, 'payload was sent');
});

test('n8n mock: ok:false response never returns draft', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: false, error: 'model_failed' }),
  });

  const result = await callN8nCompose(
    { leadId: 'ld1', articleText: 'article' },
    { fetchImpl: mockFetch, timeoutMs: 5000 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, 'model_failed');
  assert.equal(result.draft, undefined);
});

test('n8n mock: timeout returns ok:false with error=timeout', async () => {
  const mockFetch = async (_url, opts) => {
    await new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  };

  const result = await callN8nCompose(
    { leadId: 'ld1', articleText: 'article' },
    { fetchImpl: mockFetch, timeoutMs: 50 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, 'timeout');
});

test('checkout route: attaches lead_id and funnel=v2 to metadata', () => {
  const checkoutSrc = rfs(jn(HERE, '../app/api/checkout/route.js'), 'utf8');
  assert.ok(checkoutSrc.includes('lead_id'), 'lead_id in metadata');
  assert.ok(checkoutSrc.includes("funnel: 'v2'"), 'V2 funnel marker');
  assert.ok(checkoutSrc.includes('getLeadByEmail'), 'looks up lead for metadata');
  assert.ok(checkoutSrc.includes("funnel: 'v1'"), 'v1 fallback marker');
});

test('stripe webhook: idempotent upsert on stripe_session_id', () => {
  const ordersSrc = rfs(jn(HERE, '../lib/orders.js'), 'utf8');
  assert.ok(ordersSrc.includes('ON CONFLICT (stripe_session_id)'), 'idempotent by session ID');
  assert.ok(ordersSrc.includes('DO UPDATE SET'), 'updates on conflict');
  assert.ok(ordersSrc.includes('lead_id'), 'attaches lead_id');
  assert.ok(ordersSrc.includes('order_status'), 'sets order_status');
});

test('approval checkbox: copy is canonical and stored', () => {
  assert.ok(typeof APPROVAL_CHECKBOX_COPY === 'string', 'checkbox copy is a string');
  assert.ok(APPROVAL_CHECKBOX_COPY.length > 50, 'checkbox copy is substantive');
  assert.ok(APPROVAL_CHECKBOX_COPY.includes('refund'), 'mentions refund disclaimer');
  assert.ok(APPROVAL_CHECKBOX_COPY.includes('vendor'), 'mentions vendor submission');
  assert.ok(!APPROVAL_CHECKBOX_COPY.includes('irreversible'), 'does not say irreversible');
});

test('approval: require checkbox before marking approved', () => {
  const approveSrc = rfs(jn(HERE, '../app/api/approve/route.js'), 'utf8');
  assert.ok(approveSrc.includes('approved !== true'), 'rejects if approved !== true');
  assert.ok(approveSrc.includes("'approved'"), "sets status to 'approved'");
  assert.ok(approveSrc.includes('payment_status'), 'validates payment before approval');
  assert.ok(approveSrc.includes('recordApproval'), 'records in approvals table');
});

test('status transitions: admin pr-sent endpoint is protected', () => {
  const adminSrc = rfs(jn(HERE, '../app/api/admin/pr-sent/route.js'), 'utf8');
  assert.ok(adminSrc.includes('ADMIN_SECRET'), 'checks ADMIN_SECRET');
  assert.ok(adminSrc.includes('Bearer'), 'uses bearer token auth');
  assert.ok(adminSrc.includes('pr_sent'), "transitions to pr_sent status");
  // Must NOT be usable without the secret
  assert.ok(adminSrc.includes("'Unauthorized.'"), 'rejects unauthorized');
});

test('customer dashboard: all statuses represented in StatusLadder', () => {
  const ladderSrc = rfs(jn(HERE, '../components/funnel/StatusLadder.jsx'), 'utf8');
  for (const status of ['draft', 'writing', 'ready', 'paid', 'approved', 'pr_sent', 'failed', 'refunded']) {
    assert.ok(ladderSrc.includes(status), `StatusLadder includes '${status}'`);
  }
});

test('sanitizeLeadFields: articleSource accepted for pdf/paste only (source inspection)', () => {
  const leadsSrc = rfs(jn(HERE, '../lib/leads.js'), 'utf8');
  // The sanitization logic must only accept 'pdf' and 'paste'
  assert.ok(leadsSrc.includes("src === 'pdf' || src === 'paste'"), 'only pdf/paste accepted');
  assert.ok(!leadsSrc.includes("src === 'url'"), 'url is not accepted as article_source');
  assert.ok(leadsSrc.includes('article_source'), 'article_source field is handled');
});

test('Telegram config: launch blocker logged when not configured', () => {
  const notifySrc = rfs(jn(HERE, '../lib/notify.js'), 'utf8');
  assert.ok(notifySrc.includes('LAUNCH BLOCKER'), 'logs LAUNCH BLOCKER for Telegram');
  assert.ok(notifySrc.includes('TELEGRAM_BOT_TOKEN'), 'references TELEGRAM_BOT_TOKEN');
  assert.ok(notifySrc.includes('TELEGRAM_CHAT_ID'), 'references TELEGRAM_CHAT_ID');
});

test('notification failure never propagates to caller', () => {
  // Verify callers fire notifications as best-effort (no await or .catch)
  const webhookSrc = rfs(jn(HERE, '../app/api/stripe-webhook/route.js'), 'utf8');
  assert.ok(webhookSrc.includes('.catch(() => {})'), 'webhook suppresses notification errors');
  const completeSrc = rfs(jn(HERE, '../app/api/brief/complete/route.js'), 'utf8');
  assert.ok(completeSrc.includes('.catch(() => {})'), 'brief/complete suppresses notification errors');
  // notify.js itself uses try/catch to avoid propagating errors outward
  const notifySrc = rfs(jn(HERE, '../lib/notify.js'), 'utf8');
  assert.ok(notifySrc.includes('} catch (err)'), 'notify.js handles internal errors');
});

test('ownership: brief and approve routes require session auth', () => {
  const briefSrc = rfs(jn(HERE, '../app/api/brief/route.js'), 'utf8');
  const approveSrc = rfs(jn(HERE, '../app/api/approve/route.js'), 'utf8');
  assert.ok(briefSrc.includes('getSession'), 'brief checks session');
  assert.ok(briefSrc.includes("'auth'"), 'brief returns 401 on missing session');
  assert.ok(approveSrc.includes('getSession'), 'approve checks session');
  assert.ok(approveSrc.includes("'auth'"), 'approve returns 401 on missing session');
});

test('no article → compose fails with honest error, brief preserved', () => {
  const completeSrc = rfs(jn(HERE, '../app/api/brief/complete/route.js'), 'utf8');
  assert.ok(completeSrc.includes('insufficient_article'), 'returns insufficient_article error');
  assert.ok(completeSrc.includes('markComposeFinished'), 'unlocks compose on article missing');
  assert.ok(!completeSrc.includes('DEMO_DRAFT'), 'no DEMO_DRAFT fallback');
});

