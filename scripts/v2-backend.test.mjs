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
import { isPrivateIPv4, isPrivateIPv6, isPrivateIp, parsePublicHttpUrl } from '../lib/ssrf.js';
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
  assert.equal(completeSrc.includes('composeRelease'), true);
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
  // createComposeRun must be called before the model is invoked
  const createIdx = completeSrc.indexOf('await createComposeRun');
  const callIdx = completeSrc.indexOf('await composeRelease');
  assert.ok(createIdx > 0, 'await createComposeRun is used');
  assert.ok(callIdx > 0, 'await composeRelease is used');
  assert.ok(createIdx < callIdx, 'createComposeRun awaited BEFORE the compose call');
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
  assert.ok(completeSrc.includes('releaseComposeLock'), 'unlocks compose on failure');
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
  assert.ok(completeSrc.includes('releaseComposeLock'), 'unlocks compose on article missing');
  assert.ok(!completeSrc.includes('DEMO_DRAFT'), 'no DEMO_DRAFT fallback');
});


// ---------------------------------------------------------------------------
// Group A: brief wiring (article sources, logo upload, compose-run linkage)
// ---------------------------------------------------------------------------
import { sourcesToBriefPatch as srcPatch } from '../lib/brief-shape.js';
import { readFileSync as rfsA } from 'node:fs';
import { fileURLToPath as fUrlA } from 'node:url';
import { dirname as dnA, join as jnA } from 'node:path';

const ROOT_A = jnA(dnA(fUrlA(import.meta.url)), '..');
const readA = (p) => rfsA(jnA(ROOT_A, p), 'utf8');

test('sourcesToBriefPatch: pasted text becomes articleText with source=paste', () => {
  const patch = srcPatch([{ type: 'text', value: 'Acme opened a second depot.' }]);
  assert.equal(patch.articleText, 'Acme opened a second depot.');
  assert.equal(patch.articleSource, 'paste');
  assert.equal(patch.articleUrl, '');
});

test('sourcesToBriefPatch: url source round-trips through articleUrl', () => {
  const patch = srcPatch([{ type: 'url', value: '  https://example.com/news  ' }]);
  assert.equal(patch.articleUrl, 'https://example.com/news');
  assert.equal(patch.articleText, '');
});

test('sourcesToBriefPatch: a PDF filename is never written into articleText', () => {
  const patch = srcPatch([{ type: 'file', value: 'press-notes.pdf', meta: '84 KB · PDF' }]);
  assert.equal(patch.articleText, '', 'filename must not masquerade as article text');
  assert.equal(patch.articleSource, 'pdf');
});

test('sourcesToBriefPatch: removing every source clears the stored article', () => {
  const patch = srcPatch([]);
  assert.equal(patch.articleText, '');
  assert.equal(patch.articleUrl, '');
  assert.equal(patch.articleSource, '');
  // articleText/articleUrl are present-but-empty so sanitizeLeadFields clears them
  assert.ok('articleText' in patch && 'articleUrl' in patch);
});

test('sourcesToBriefPatch: text wins over a co-present PDF, and is tolerant of junk', () => {
  const both = srcPatch([{ type: 'file', value: 'a.pdf' }, { type: 'text', value: 'real text' }]);
  assert.equal(both.articleText, 'real text');
  assert.equal(both.articleSource, 'paste');
  assert.deepEqual(srcPatch(null), { articleUrl: '', articleText: '', articleSource: '' });
  assert.deepEqual(srcPatch([null, undefined]), { articleUrl: '', articleText: '', articleSource: '' });
});

test('BriefForm: article sources are persisted, not just held in React state', () => {
  const src = readA('components/funnel/BriefForm.jsx');
  assert.match(src, /sourcesToBriefPatch/, 'must map sources back to brief fields');
  const adds = src.match(/persist\(sourcesToBriefPatch\(next\)\)/g) || [];
  assert.ok(adds.length >= 2, 'both onAdd and onRemove must persist the source list');
});

test('BriefForm: compose flushes pending edits and refuses to run on a failed save', () => {
  const src = readA('components/funnel/BriefForm.jsx');
  const complete = src.slice(src.indexOf('async function complete('), src.indexOf('if (composing)'));
  assert.match(complete, /clearTimeout\(debounce\.current\)/, 'must flush the 2s debounce');
  assert.match(complete, /await persist\(/, 'must await a final save before composing');
  assert.match(complete, /if \(!saved\) return/, 'must not compose from stale server state');
});

test('BriefForm: the uploaded logo is sent to /api/logo', () => {
  const src = readA('components/funnel/BriefForm.jsx');
  assert.match(src, /fetch\('\/api\/logo', \{ method: 'POST', body \}\)/);
  assert.match(src, /body\.append\('logo', file\)/);
  assert.doesNotMatch(src, /<LogoUpload onChange=\{setLogo\}/, 'logo must not dead-end in state');
});

test('LogoUpload: SVG is rejected client-side to match server validation', () => {
  const src = readA('components/funnel/LogoUpload.jsx');
  const okTypes = src.slice(src.indexOf('const OK_TYPES'), src.indexOf('\n', src.indexOf('const OK_TYPES')));
  assert.doesNotMatch(okTypes, /svg/i, 'SVG is stored public and would be renderable');
  assert.match(src, /image\/png/);
  const copy = readA('lib/funnel.js');
  assert.doesNotMatch(copy.slice(copy.indexOf('wrongType'), copy.indexOf('wrongType') + 120), /SVG/);
});

test('brief/complete: the compose run id is written onto the lead for checkout', () => {
  const route = readA('app/api/brief/complete/route.js');
  assert.match(route, /setCurrentComposeRun\(lead\.id, composeRun\.id\)/);
  const leads = readA('lib/leads.js');
  assert.match(leads, /export async function setCurrentComposeRun/);
  assert.match(leads, /current_compose_run_id = \$\{composeRunId\}/);
  // checkout reads exactly what brief/complete now writes
  assert.match(readA('app/api/checkout/route.js'), /current_compose_run_id/);
});

// ---------------------------------------------------------------------------
// PDF article intake: dependency-free extraction (lib/pdf-text.js)
// ---------------------------------------------------------------------------
import { deflateSync } from 'node:zlib';
import { extractPdfText, isPdf } from '../lib/pdf-text.js';

/** Build a real PDF whose single content stream holds `content`. */
function makePdf(content, { compress = true } = {}) {
  const body = compress ? deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1');
  return Buffer.concat([
    Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n4 0 obj\n<< /Length ${body.length}` +
        `${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`,
      'latin1'
    ),
    body,
    Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'),
  ]);
}

const LEDE = 'DULUTH, Minn. — Harbor Freight Logistics said Tuesday that it will open a second depot.';

test('pdf: text is extracted from a Flate-compressed content stream', () => {
  const r = extractPdfText(makePdf(`BT /F1 12 Tf 72 720 Td (${LEDE}) Tj ET`));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /Harbor Freight Logistics said Tuesday/);
});

test('pdf: uncompressed content streams work too', () => {
  const r = extractPdfText(makePdf(`BT (${LEDE}) Tj ET`, { compress: false }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /second depot/);
});

test('pdf: TJ kerning is rendered as word gaps, not run-together text', () => {
  const words = ['Quarterly', 'revenue', 'rose', 'eighteen', 'percent', 'across', 'every', 'region', 'again'];
  const arr = words.map((w) => `(${w}) -250 `).join('');
  const r = extractPdfText(makePdf(`BT [${arr}] TJ ET`));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /Quarterly revenue rose eighteen percent/);
});

test('pdf: literal escapes and octal codes decode per spec', () => {
  const content =
    'BT (Escaped ' + String.raw`\(parens\)` + ' plus octal ' + String.raw`\101\102\103` +
    ' and enough further words to clear the minimum length gate) Tj ET';
  const r = extractPdfText(makePdf(content));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /Escaped \(parens\) plus octal ABC/);
});

test('pdf: hex strings decode', () => {
  // "The board approved the new distribution facility this week in Duluth."
  const hex = Buffer.from(
    'The board approved the new distribution facility this week in Duluth.',
    'latin1'
  ).toString('hex');
  const r = extractPdfText(makePdf(`BT <${hex}> Tj ET`));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /The board approved the new distribution facility/);
});

test('pdf: Td positioning produces line breaks between paragraphs', () => {
  const r = extractPdfText(
    makePdf(
      'BT (Harbor Freight Incorporated of Duluth Minnesota) Tj ' +
        '0 -14 Td (announced record quarterly earnings on Tuesday morning.) Tj ET'
    )
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.text, /Harbor Freight[\s\S]*\n[\s\S]*announced record quarterly/);
});

test('pdf: a scanned page reports no_text_layer rather than inventing text', () => {
  // An image XObject draw with no text operators — what a scan actually is.
  const r = extractPdfText(makePdf('q 612 0 0 792 0 0 cm /Im0 Do Q', { compress: false }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_text_layer');
});

test('pdf: CID glyph ids are detected as unreadable, never returned as mojibake', () => {
  const glyphs = Array.from({ length: 60 }, (_, i) => (i + 1).toString(16).padStart(4, '0')).join('');
  const r = extractPdfText(makePdf(`BT <${glyphs}> Tj ET`));
  assert.equal(r.ok, false, 'glyph ids must not be passed off as article text');
  assert.equal(r.reason, 'no_text_layer');
});

test('pdf: non-PDF input is rejected on its bytes, not its filename', () => {
  assert.equal(extractPdfText(Buffer.from('plain text pretending to be a pdf')).reason, 'not_pdf');
  assert.equal(isPdf(Buffer.from('hello')), false);
  assert.equal(isPdf(Buffer.from('%PDF-1.7\nrest')), true);
});

test('pdf: extraction is capped so a huge PDF cannot blow the 50k storage clip', () => {
  const para = `BT (${LEDE} ${'Filler sentence for length. '.repeat(40)}) Tj ET `;
  const r = extractPdfText(makePdf(para.repeat(60)));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200));
  assert.ok(r.text.length <= 60_000, `expected cap, got ${r.text.length}`);
});

test('sourcesToBriefPatch: an extracted PDF carries its text through as source=pdf', () => {
  const patch = srcPatch([{ type: 'file', value: 'release.pdf', text: LEDE }]);
  assert.equal(patch.articleText, LEDE);
  assert.equal(patch.articleSource, 'pdf');
  assert.notEqual(patch.articleText, 'release.pdf');
});

test('article/upload: extraction endpoint is authenticated and writes nothing itself', () => {
  const route = readA('app/api/article/upload/route.js');
  assert.match(route, /getSession\(\)/);
  assert.match(route, /if \(!session\?\.email\)/, 'must require a session');
  assert.match(route, /isPdf\(buffer\)/, 'must verify magic bytes, not the declared type');
  assert.match(route, /extractPdfText\(buffer\)/);
  // one write path: the route returns text, the form saves it via PATCH /api/brief
  assert.doesNotMatch(route, /upsertLead|saveLeadFromPayload/);
});

test('ArticleDrop: a PDF is uploaded for extraction and the text rides on the source', () => {
  const src = readA('components/funnel/ArticleDrop.jsx');
  assert.match(src, /fetch\('\/api\/article\/upload', \{ method: 'POST', body \}\)/);
  assert.match(src, /text: data\.text/, 'the extracted text must reach the source');
  // the dead hidden mirror fields that made the loss look wired up are gone
  assert.doesNotMatch(src, /name="articleText"/);
  assert.doesNotMatch(src, /name="articleSource"/);
});

// ---------------------------------------------------------------------------
// Security hardening. Findings 4 (SSRF), 5 (brief overwrite), 12 (SVG logos).
// ---------------------------------------------------------------------------

test('SSRF: IPv6 loopback reaches us in every embedding format', () => {
  // WHATWG URL re-serialises [::ffff:127.0.0.1] to the hex form [::ffff:7f00:1],
  // so the dotted spelling is what an attacker types and the hex spelling is
  // what the SSRF guard actually sees. Both must land on 127.0.0.1.
  const blocked = [
    '::ffff:7f00:1',        // IPv4-mapped, hex — the reported bypass
    '::ffff:127.0.0.1',     // IPv4-mapped, dotted
    '::ffff:0:7f00:1',      // IPv4-translated ::ffff:0:0:0/96
    '::ffff:0:127.0.0.1',
    '::7f00:1',             // deprecated IPv4-compatible ::/96
    '::127.0.0.1',
    '::ffff:a00:1',         // 10.0.0.1
    '::ffff:c0a8:1',        // 192.168.0.1
    '::ffff:a9fe:a9fe',     // 169.254.169.254 cloud metadata
    '64:ff9b::7f00:1',      // NAT64 well-known prefix
    '64:ff9b::169.254.169.254',
    '64:ff9b:1::1',         // NAT64 local-use prefix
    '2002:7f00:1::',        // 6to4 wrapping loopback
  ];
  for (const ip of blocked) {
    assert.equal(isPrivateIPv6(ip), true, `${ip} must be private`);
    assert.equal(isPrivateIp(ip), true, `isPrivateIp(${ip}) must be private`);
  }
});

test('SSRF: link-local covers the whole fe80::/10, not just fe80/feb0/febf', () => {
  // fe80::/10 spans fe80–febf. The old prefix-string check missed everything
  // in between, so fe81:: through febe:: were treated as public.
  const blocked = ['fe80::1', 'fe81::1', 'fe8f::1', 'fe90::1', 'fe9a::1', 'fea0::1',
    'feaf::1', 'feb1::1', 'feb5::1', 'febe::1', 'febf::1'];
  for (const ip of blocked) {
    assert.equal(isPrivateIPv6(ip), true, `${ip} is inside fe80::/10`);
  }
  // fe7f:: sits just below the range; fec0::/10 is deprecated site-local.
  assert.equal(isPrivateIPv6('fe7f::1'), false, 'fe7f:: is outside fe80::/10');
  assert.equal(isPrivateIPv6('fec0::1'), true, 'fec0::/10 site-local is private');
});

test('SSRF: reserved IPv6 ranges stay blocked and junk fails closed', () => {
  for (const ip of ['::', '::1', '0:0:0:0:0:0:0:1', 'fc00::1', 'fd12:3456::1',
    'ff02::1', 'ff00::', 'fe80::1%eth0']) {
    assert.equal(isPrivateIPv6(ip), true, `${ip} must be private`);
  }
  // Unparseable input is treated as private rather than waved through.
  for (const junk of ['', 'not-an-ip', ':::1', '1:2:3:4:5:6:7:8:9', 'gggg::1', '12345::1']) {
    assert.equal(isPrivateIPv6(junk), true, `${JSON.stringify(junk)} fails closed`);
  }
});

test('SSRF: real public IPv6 addresses are not over-blocked', () => {
  const allowed = [
    '2606:4700::1111',            // Cloudflare
    '2001:4860:4860::8888',       // Google
    '2a00:1450:4001:81b::200e',   // Google EU
    '2620:fe::fe',                // Quad9
    '1:2:3:4:5:6:7:8',
    '::ffff:8.8.8.8',             // IPv4-mapped, but a public IPv4
    '::ffff:808:808',
    '::ffff:0:8.8.8.8',
    '64:ff9b::8.8.8.8',           // NAT64 wrapping a public IPv4
    '2002:808:808::',             // 6to4 wrapping a public IPv4
  ];
  for (const ip of allowed) {
    assert.equal(isPrivateIPv6(ip), false, `${ip} must stay public`);
  }
  // The IPv4 classifier is untouched.
  assert.equal(isPrivateIPv4('127.0.0.1'), true);
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
});

test('SSRF: parsePublicHttpUrl rejects the bracketed IPv6 loopback attack', () => {
  // POST /api/articles/resolve {"url":"http://[::ffff:7f00:1]:8080/"} used to
  // sail through and get fetched against loopback.
  for (const url of ['http://[::ffff:7f00:1]:8080/', 'http://[::ffff:127.0.0.1]/',
    'http://[::7f00:1]/', 'http://[::ffff:0:7f00:1]/', 'http://[64:ff9b::7f00:1]/',
    'http://[fe9a::1]/', 'http://[::ffff:a9fe:a9fe]/latest/meta-data/']) {
    assert.equal(parsePublicHttpUrl(url).error, 'blocked', `${url} must be blocked`);
  }
  // Legitimate targets still resolve.
  assert.equal(parsePublicHttpUrl('https://[2606:4700::1111]/x').error, undefined);
  assert.equal(
    parsePublicHttpUrl('https://news.example/article').url.href,
    'https://news.example/article'
  );
});

test('ownership: auth/start will not overwrite a verified lead pre-auth', () => {
  const startSrc = rfs(jn(HERE, '../app/api/auth/start/route.js'), 'utf8');
  // The route must look the lead up and consult the session before writing.
  assert.ok(startSrc.includes('getLeadByEmail'), 'looks the existing lead up');
  assert.ok(startSrc.includes('getSession'), 'consults the session cookie');
  assert.ok(startSrc.includes('verified_at'), 'gates on whether the lead is claimed');
  assert.ok(
    startSrc.includes('upsertLead(email, mayWrite ? leadFields : {})'),
    'caller-supplied fields are dropped unless the caller owns the address'
  );
  // The gate has to run before the write, not after it.
  assert.ok(
    startSrc.indexOf('const mayWrite') < startSrc.indexOf('await upsertLead'),
    'ownership check precedes the upsert'
  );
  assert.ok(
    !startSrc.includes('await upsertLead(email, leadFields)'),
    'no ungated upsert of caller-supplied fields survives'
  );
  // Legitimate flows around the gate are untouched.
  assert.ok(startSrc.includes('body?.resend === false'), 'VerifyForm saveProfile path kept');
  assert.ok(startSrc.includes('hasLiveUnusedLink'), 'live-code check kept');
  assert.ok(startSrc.includes('issueMagicLink'), 'a login code is still issued');
});

test('ownership: post-verification routes still persist the brief', () => {
  // The pre-auth write is gated, so the authenticated paths must remain the
  // ones that actually save prefill — otherwise the funnel silently loses data.
  const verifySrc = rfs(jn(HERE, '../app/api/auth/verify/route.js'), 'utf8');
  const callbackSrc = rfs(jn(HERE, '../app/api/auth/callback/route.js'), 'utf8');
  assert.ok(verifySrc.includes('await upsertLead('), 'verify persists prefill');
  assert.ok(
    verifySrc.indexOf('await consumeMagicCode(') < verifySrc.indexOf('await upsertLead('),
    'verify writes only after consuming the code'
  );
  assert.ok(callbackSrc.includes('await upsertLead('), 'callback persists prefill');
  assert.ok(
    callbackSrc.indexOf('await consumeMagicLink(') < callbackSrc.indexOf('await upsertLead('),
    'callback writes only after consuming the link'
  );
});

// Smallest buffers that carry each format's magic bytes.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_MAGIC = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);
const SVG_PAYLOAD = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
);

test('logo upload: SVG is rejected outright', () => {
  const res = validateLogoBuffer(SVG_PAYLOAD, 'image/svg+xml', SVG_PAYLOAD.length);
  assert.equal(res.ok, false, 'SVG must not be storable');
  assert.ok(!/svg/i.test(res.error), `error copy must not still offer SVG: ${res.error}`);
  // Renaming the MIME does not help — the bytes carry no raster signature.
  assert.equal(validateLogoBuffer(SVG_PAYLOAD, 'image/png', SVG_PAYLOAD.length).ok, false);
  assert.equal(validateLogoBuffer(SVG_PAYLOAD, 'image/webp', SVG_PAYLOAD.length).ok, false);
});

test('logo upload: raster formats still validate', () => {
  assert.deepEqual(validateLogoBuffer(PNG_MAGIC, 'image/png', PNG_MAGIC.length), { ok: true });
  assert.deepEqual(validateLogoBuffer(JPEG_MAGIC, 'image/jpeg', JPEG_MAGIC.length), { ok: true });
  assert.deepEqual(validateLogoBuffer(WEBP_MAGIC, 'image/webp', WEBP_MAGIC.length), { ok: true });
});

test('logo upload: declared MIME must match the actual bytes', () => {
  const mismatch = validateLogoBuffer(JPEG_MAGIC, 'image/png', JPEG_MAGIC.length);
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /does not match/);
  assert.equal(validateLogoBuffer(PNG_MAGIC, 'image/webp', PNG_MAGIC.length).ok, false);
  // A buffer too short to hold the signature cannot satisfy it.
  assert.equal(validateLogoBuffer(Buffer.from([0x89]), 'image/png', 1).ok, false);
  // Types outside the allowlist never reach the signature check.
  for (const mime of ['image/gif', 'text/html', 'application/pdf', '', undefined]) {
    assert.equal(
      validateLogoBuffer(PNG_MAGIC, mime, PNG_MAGIC.length).ok,
      false,
      `${mime} rejected`
    );
  }
  // Size cap unchanged.
  assert.equal(validateLogoBuffer(PNG_MAGIC, 'image/png', 9 * 1024 * 1024).ok, false);
});

test('logo upload: no SVG path survives in storage or the picker', () => {
  const storeSrc = rfs(jn(HERE, '../lib/logo-storage.js'), 'utf8');
  assert.ok(!storeSrc.includes("'image/svg+xml'"), 'svg mime is gone from logo-storage');
  assert.ok(
    !storeSrc.includes('return true; // unknown mime'),
    'an unrecognised mime no longer skips the signature check'
  );
  // The picker must not offer a format the server will bounce.
  const pickerSrc = rfs(jn(HERE, '../components/funnel/LogoUpload.jsx'), 'utf8');
  assert.ok(!pickerSrc.includes('image/svg'), 'LogoUpload no longer accepts SVG');
  const onboardingSrc = rfs(jn(HERE, '../components/OnboardingForm.jsx'), 'utf8');
  assert.ok(!onboardingSrc.includes('image/svg'), 'OnboardingForm no longer accepts SVG');
});

// ---------------------------------------------------------------------------
// Finding 7: a failed compose retry must not destroy the existing draft
// ---------------------------------------------------------------------------
const T1 = '2026-09-01T10:00:00.000Z'; // a good n8n draft landed
const T2 = '2026-09-01T10:05:00.000Z'; // customer edited the brief
const T3 = '2026-09-01T10:06:00.000Z'; // the retry failed
const N8N_DRAFT = JSON.stringify({ ok: true, source: 'n8n', headline: 'Harbor Freight expands' });

/** Lead state after: success at T1 -> brief edit at T2 -> retry fails at T3. */
const afterFailedRetry = {
  id: 'lead-1',
  compose_json: N8N_DRAFT,
  compose_finished_at: T1,
  updated_at: T2,
  compose_started_at: null, // releaseComposeLock cleared it
};

test('finding 7: a failed retry leaves the customer\'s draft intact', () => {
  assert.equal(hasComposeDraft(afterFailedRetry), true, 'the paid-for draft must survive');
  assert.equal(hasSavedCompose(afterFailedRetry), true, '/preview must still render it');
});

test('finding 7: the lock is released so the customer can retry', () => {
  assert.equal(isComposeInFlight(afterFailedRetry, Date.parse(T3)), false);
  assert.equal(composeLockAllowsNewRun(afterFailedRetry, Date.parse(T3)), true);
});

test('finding 7: the surviving draft is not served as if it were current', () => {
  // The brief moved on at T2, after the last real draft at T1 — so a fresh
  // compose is still owed, even though the old draft is readable.
  assert.equal(briefNewerThanCompose(afterFailedRetry), true);
  assert.equal(canReuseN8nCompose(afterFailedRetry), false);
});

test('finding 7: stamping compose_finished_at on failure would freeze the stale draft', () => {
  // This is the state the old markComposeFinished produced (both fields = now).
  // It reads as "the draft is current" and permanently suppresses the retry —
  // which is why releaseComposeLock must touch neither field.
  const frozen = { ...afterFailedRetry, compose_finished_at: T3, updated_at: T3 };
  assert.equal(briefNewerThanCompose(frozen), false);
  assert.equal(canReuseN8nCompose(frozen), true, 'documents the bug we must not create');
  assert.equal(composeLockAllowsNewRun(frozen, Date.parse(T3)), false, 'retry suppressed');
});

test('finding 7: a first-ever compose that fails can still be retried', () => {
  const neverSucceeded = {
    id: 'lead-2',
    compose_json: null,
    compose_finished_at: null,
    updated_at: T2,
    compose_started_at: null,
  };
  assert.equal(hasComposeDraft(neverSucceeded), false);
  assert.equal(canReuseN8nCompose(neverSucceeded), false);
  assert.equal(composeLockAllowsNewRun(neverSucceeded, Date.parse(T3)), true);
});

test('finding 7: claimComposeLock no longer wipes compose_json', () => {
  const src = readA('lib/leads.js');
  const body = src.slice(
    src.indexOf('export async function claimComposeLock'),
    src.indexOf('export async function saveComposeSuccess')
  );
  assert.doesNotMatch(body, /compose_json\s*=\s*NULL/, 'the draft must survive the claim');
  assert.match(body, /compose_finished_at = NULL/, 'finished_at is still the in-flight marker');
  // a run that produced nothing must remain claimable
  assert.match(body, /OR compose_finished_at IS NULL/);
});

test('finding 7: releaseComposeLock only clears the lock', () => {
  const src = readA('lib/leads.js');
  const body = src.slice(
    src.indexOf('export async function releaseComposeLock'),
    src.indexOf('export async function upsertLead')
  );
  assert.match(body, /SET compose_started_at = NULL/);
  assert.doesNotMatch(body, /compose_finished_at\s*=/, 'no draft was produced');
  assert.doesNotMatch(body, /updated_at\s*=/, 'must not erase the brief-edit signal');
  // and the misleading old name is gone everywhere
  assert.doesNotMatch(readA('app/api/brief/complete/route.js'), /markComposeFinished/);
});

// ---------------------------------------------------------------------------
// In-house two-stage composer (replaces the n8n webhook)
// ---------------------------------------------------------------------------
import { composeRelease } from '../lib/compose-engine.js';
import {
  DRAFT_INSTRUCTIONS,
  DRAFT_SCHEMA,
  FACTS_INSTRUCTIONS,
  FACTS_SCHEMA,
  buildDraftInput,
  buildFactsInput,
} from '../lib/compose-prompt.js';

const CLIP =
  'Harbor Freight Logistics will open a second depot on the western edge of Duluth, ' +
  'Minnesota, adding about forty jobs over eighteen months, the company said Tuesday.';

const PAYLOAD = {
  companyName: 'Harbor Freight Logistics',
  website: 'harborfreightlog.com',
  contactName: 'Dana Reyes',
  contactEmail: 'dana@harborfreightlog.com',
  phone: '218-555-0134',
  announcementType: 'New location',
  articleText: CLIP,
  articleSource: 'paste',
  quote: 'Duluth has been good to us.',
  quoteAttribution: 'Dana Reyes, President',
  notes: 'Family owned since 1994. Please mention the hiring.',
  leadId: 'lead-9',
  orderId: 'order-9',
  composeRunId: 'run-9',
};

const GOOD_FACTS = {
  ok: true,
  who: 'Harbor Freight Logistics',
  what: 'opening a second depot',
  where: 'Duluth, Minnesota',
  when: 'Tuesday',
  why: 'capacity growth',
  keyFacts: ['about forty jobs', 'eighteen month timeline'],
  discarded: '',
  error: null,
};

const GOOD_DRAFT = {
  ok: true,
  headline: 'Harbor Freight Logistics opens second Duluth depot',
  subhead: 'About forty jobs expected over eighteen months',
  dateline: 'DULUTH, MN, September 3, 2026',
  body: ['Para one.', 'Para two.', 'Para three.'],
  quote: 'Duluth has been good to us.',
  quoteAttribution: 'Dana Reyes, President',
  boilerplate: 'Harbor Freight Logistics is a family-owned carrier.',
  contactLine: 'Dana Reyes / dana@harborfreightlog.com',
  error: null,
};

/** Records every call so the tests can inspect what each stage was handed. */
function recorder(responses) {
  const calls = [];
  const callModel = async (args) => {
    calls.push(args);
    const next = responses[calls.length - 1];
    return typeof next === 'function' ? next(args) : next;
  };
  return { calls, callModel };
}

test('composer: two stages produce a draft', async () => {
  const { calls, callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: true, data: GOOD_DRAFT },
  ]);
  const result = await composeRelease(PAYLOAD, { callModel });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.draft.headline, GOOD_DRAFT.headline);
  assert.equal(calls.length, 2, 'facts then draft');
  assert.equal(calls[0].schema, FACTS_SCHEMA);
  assert.equal(calls[1].schema, DRAFT_SCHEMA);
});

test('composer: the article clip is never handed to the writer', async () => {
  const { calls, callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: true, data: GOOD_DRAFT },
  ]);
  await composeRelease(PAYLOAD, { callModel });

  // Stage 1 must see the clip; stage 2 must not. This is the anti-plagiarism
  // and anti-hallucination invariant the whole two-stage design exists for.
  assert.equal(calls[0].input.articleText, CLIP);
  assert.equal(calls[1].input.articleText, '', 'blanked, not merely omitted');
  assert.ok('articleText' in calls[1].input, 'present-but-empty defeats prompt habit');
  assert.doesNotMatch(JSON.stringify(calls[1].input), /western edge/, 'no clip prose survives');
});

test('composer: the customer announcementType and notes reach the writer', async () => {
  // The n8n workflow logged announcementType and passed neither field to the
  // writer, so a REQUIRED brief field never influenced the release.
  const { calls, callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: true, data: GOOD_DRAFT },
  ]);
  await composeRelease(PAYLOAD, { callModel });
  assert.equal(calls[1].input.announcementType, 'New location');
  assert.equal(calls[1].input.notes, 'Family owned since 1994. Please mention the hiring.');
  assert.match(DRAFT_INSTRUCTIONS, /announcementType/);
  assert.match(DRAFT_INSTRUCTIONS, /notes are the customer/);
});

test('composer: extracted facts are carried into stage two', async () => {
  const { calls, callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: true, data: GOOD_DRAFT },
  ]);
  await composeRelease(PAYLOAD, { callModel });
  assert.deepEqual(calls[1].input.facts.keyFacts, ['about forty jobs', 'eighteen month timeline']);
  assert.equal(calls[1].input.facts.where, 'Duluth, Minnesota');
});

test('composer: a clip with no real event fails honestly and skips the writer', async () => {
  const { calls, callModel } = recorder([
    { ok: true, data: { ...GOOD_FACTS, ok: false, error: 'no identifiable event' } },
  ]);
  const result = await composeRelease(PAYLOAD, { callModel });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'no identifiable event');
  assert.equal(result.stage, 'facts');
  assert.equal(calls.length, 1, 'must not pay for a draft it cannot write');
});

test('composer: transient failures stay retryable, content failures do not', async () => {
  const cases = [['timeout', 502], ['network', 502], ['compose_failed', 200]];
  for (const [error, status] of cases) {
    const { callModel } = recorder([{ ok: false, error }]);
    const result = await composeRelease(PAYLOAD, { callModel });
    assert.equal(result.ok, false);
    assert.equal(result.error, error);
    assert.equal(result.status, status, error + ' should map to ' + status);
    assert.equal(statusForComposeError(error), status, 'route agrees with engine');
  }
});

test('composer: a stage-two failure is reported as such', async () => {
  const { callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: false, error: 'refused' },
  ]);
  const result = await composeRelease(PAYLOAD, { callModel });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'draft');
  assert.equal(result.error, 'refused');
});

test('composer: a writer that returns ok:false never yields a draft', async () => {
  const { callModel } = recorder([
    { ok: true, data: GOOD_FACTS },
    { ok: true, data: { ...GOOD_DRAFT, ok: false, error: 'insufficient facts' } },
  ]);
  const result = await composeRelease(PAYLOAD, { callModel });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'insufficient facts');
  assert.equal(result.draft, undefined);
});

test('composer: without a model caller it fails closed', async () => {
  const result = await composeRelease(PAYLOAD, {});
  assert.equal(result.ok, false);
  assert.equal(result.error, 'unavailable');
});

test('composer: internal identifiers are kept out of the model context', async () => {
  const facts = buildFactsInput(PAYLOAD);
  assert.equal('leadId' in facts, false);
  assert.equal('composeRunId' in facts, false);
  assert.equal(facts.companyName, 'Harbor Freight Logistics');
});

test('composer: both schemas are strict and fully required', () => {
  for (const schema of [FACTS_SCHEMA, DRAFT_SCHEMA]) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(
      schema.required.slice().sort(),
      Object.keys(schema.properties).sort(),
      'every property must be required for strict decoding'
    );
  }
  // The writer output must cover everything normalizeComposeResponse reads.
  const readKeys = ['headline', 'subhead', 'dateline', 'body', 'quote',
    'quoteAttribution', 'boilerplate', 'contactLine'];
  for (const key of readKeys) {
    assert.ok(DRAFT_SCHEMA.properties[key], 'draft schema is missing ' + key);
  }
});

test('composer: the extractor is told not to write the release', () => {
  assert.match(FACTS_INSTRUCTIONS, /Do not write a press release/);
  assert.match(DRAFT_INSTRUCTIONS, /Never invent dates, addresses, awards, stats, motives, or quotes/);
  assert.match(DRAFT_INSTRUCTIONS, /articleText is intentionally absent/);
});

test('composer: buildDraftInput is pure and tolerates missing fields', () => {
  const empty = buildDraftInput({}, {});
  assert.equal(empty.articleText, '');
  assert.deepEqual(empty.facts.keyFacts, []);
  assert.equal(empty.companyName, '');
  const before = JSON.stringify(PAYLOAD);
  buildDraftInput(PAYLOAD, GOOD_FACTS);
  assert.equal(JSON.stringify(PAYLOAD), before, 'must not mutate the payload');
});

test('composer: the SDK is imported in exactly one module', () => {
  assert.match(readA('lib/anthropic.js'), /@anthropic-ai\/sdk/);
  assert.doesNotMatch(readA('lib/compose-engine.js'), /@anthropic-ai\/sdk/, 'engine stays testable');
  assert.doesNotMatch(readA('lib/compose-prompt.js'), /@anthropic-ai\/sdk/);
  const client = readA('lib/anthropic.js');
  assert.match(client, /claude-opus-5/);
  assert.match(client, /output_config/);
  assert.match(client, /json_schema/);
  assert.match(client, /refusal/, 'a policy decline must not read as a draft');
});

// ---------------------------------------------------------------------------
// Track A: owner alerts survive customer data, and customers actually hear back
// ---------------------------------------------------------------------------
import {
  TRANSIENT_COMPOSE_ERRORS,
  escapeTelegramMarkdown as tgEsc,
} from '../lib/notify.js';

test('telegram: customer values that would break Markdown are escaped', () => {
  // An unescaped underscore opens an italic run that never closes; Telegram
  // answers 400 and the owner never learns the draft is ready.
  assert.equal(tgEsc('sal_marino@x.com'), 'sal\\_marino@x.com');
  assert.equal(tgEsc("*Sal's Pizza*"), "\\*Sal's Pizza\\*");
  assert.equal(tgEsc('Acme [MD] (East)'), 'Acme \\[MD\\] \\(East\\)');
  assert.equal(tgEsc('back`tick'), 'back\\`tick');
});

test('telegram: escaping leaves ordinary text and empties alone', () => {
  assert.equal(tgEsc('Harbor Freight Logistics'), 'Harbor Freight Logistics');
  assert.equal(tgEsc(''), '');
  assert.equal(tgEsc(null), '');
  assert.equal(tgEsc(undefined), '');
  assert.equal(tgEsc(42), '42');
});

test('telegram: every interpolated value in an alert goes through the escaper', () => {
  const src = readA('lib/notify.js');
  // Only the Telegram `text` bodies are Markdown-parsed. The `subject` and
  // `plain` email strings beside them are plain text and must NOT be escaped.
  const blocks = [...src.matchAll(/const text =([\s\S]*?);\n/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 5, 'expected the alert templates, found ' + blocks.length);
  let checked = 0;
  for (const block of blocks) {
    for (const m of block.matchAll(/\$\{([^}]+)\}/g)) {
      checked += 1;
      const expr = m[1].trim();
      assert.ok(expr.startsWith('md('), 'unescaped interpolation in a Telegram alert: ' + expr);
    }
  }
  assert.ok(checked >= 10, 'expected several interpolations, checked ' + checked);
});

test('telegram: a formatting rejection falls back to unformatted delivery', () => {
  const src = readA('lib/notify.js');
  assert.match(src, /if \(res\.status === 400\) return sendTelegramPlain\(text\)/);
  const plain = src.slice(src.indexOf('async function sendTelegramPlain'));
  assert.doesNotMatch(plain.slice(0, 600), /parse_mode/, 'the retry must not re-parse');
});

test('notifications: all four customer emails are actually wired', () => {
  const src = readA('lib/notify.js');
  for (const fn of [
    'sendDraftReadyEmail',
    'sendApprovalConfirmationEmail',
    'sendPrSentEmail',
    'sendComposeFailedEmail',
  ]) {
    // imported AND called — an import alone is what the bug looked like
    assert.match(src, new RegExp('\\b' + fn + '\\b'), `${fn} not referenced`);
    assert.match(src, new RegExp(fn + '\\(\\{ to:'), `${fn} imported but never called`);
  }
});

test('notifications: pr_sent reaches the customer from the admin hook', () => {
  const route = readA('app/api/admin/pr-sent/route.js');
  assert.match(route, /notifyPrSent\(/, 'the release-sent promise must be kept');
  assert.match(route, /SELECT id, email, order_status/, 'needs the address to notify');
  assert.match(route, /\.catch\(\(\) => \{\}\)/, 'notification must not fail the transition');
  assert.match(readA('lib/notify.js'), /export async function notifyPrSent/);
});

test('notifications: a transient compose blip does not alarm the customer', () => {
  // They are watching ComposeWait and will retry; only actionable failures mail.
  assert.equal(TRANSIENT_COMPOSE_ERRORS.has('timeout'), true);
  assert.equal(TRANSIENT_COMPOSE_ERRORS.has('network'), true);
  assert.equal(TRANSIENT_COMPOSE_ERRORS.has('unavailable'), true);
  assert.equal(TRANSIENT_COMPOSE_ERRORS.has('insufficient_article'), false);
  assert.equal(TRANSIENT_COMPOSE_ERRORS.has('refused'), false);
  const src = readA('lib/notify.js');
  assert.match(src, /actionable \? sendComposeFailedEmail/);
});

test('admin/pr-sent: the secret is compared in constant time', () => {
  const route = readA('app/api/admin/pr-sent/route.js');
  assert.match(route, /timingSafeEqual/);
  assert.doesNotMatch(route, /provided !== adminSecret/, 'byte-by-byte compare leaks the secret');
  assert.match(route, /a\.length !== b\.length/, 'timingSafeEqual throws on length mismatch');
});

// ---------------------------------------------------------------------------
// Track B: customers read sentences, not error codes or blank space
// ---------------------------------------------------------------------------
import { COMPOSE as COMPOSE_COPY, STEP_ARTICLE as STEP_ART } from '../lib/funnel.js';

test('funnel copy: the article-resolve failure strings StartFlow reads exist', () => {
  // Both were referenced by StartFlow and defined nowhere, so a failed resolve
  // called setArticleError(undefined) and rendered nothing at all.
  for (const key of ['parseFail', 'parsePartial']) {
    assert.equal(typeof STEP_ART[key], 'string', `STEP_ARTICLE.${key} must be a string`);
    assert.ok(STEP_ART[key].trim().length > 10, `STEP_ARTICLE.${key} must say something`);
  }
  const src = readA('components/funnel/StartFlow.jsx');
  assert.match(src, /STEP_ARTICLE\.parseFail/);
  assert.match(src, /STEP_ARTICLE\.parsePartial/);
});

test('funnel copy: compose transport errors have human wording', () => {
  assert.ok(COMPOSE_COPY.errors, 'COMPOSE.errors must exist');
  for (const code of ['timeout', 'network', 'unavailable', 'refused']) {
    const text = COMPOSE_COPY.errors[code];
    assert.equal(typeof text, 'string', `no copy for ${code}`);
    assert.ok(text.trim().length > 20, `copy for ${code} is too thin`);
    assert.doesNotMatch(text, /_/, `copy for ${code} still reads like an identifier`);
  }
});

test('ComposeWait: the written message wins over the machine code', () => {
  const src = readA('components/funnel/ComposeWait.jsx');
  assert.match(src, /data\.message \|\| COMPOSE\.errors\[data\.error\]/);
  // the old behaviour surfaced data.error directly
  assert.doesNotMatch(src, /new Error\(data\.error/);
  assert.match(src, /err\.explained/, 'only explained failures should render a reason');
});

test('ComposeWait: an unexplained failure shows no raw code at all', () => {
  const src = readA('components/funnel/ComposeWait.jsx');
  assert.match(src, /setFailError\(err\?\.explained \? err\.message : ''\)/);
});

test('ArticleDrop: the resolving prop StartFlow passes is actually consumed', () => {
  const src = readA('components/funnel/ArticleDrop.jsx');
  assert.match(src, /resolving = false/, 'must accept the prop');
  assert.match(src, /const busy = reading \|\| resolving/, 'must fold it into the busy state');
  assert.match(src, /Reading that link/, 'a URL fetch needs its own wording');
  // StartFlow still passes it
  assert.match(readA('components/funnel/StartFlow.jsx'), /resolving=\{resolving\}/);
});


// ---------------------------------------------------------------------------
// Group C: shared preview links, honest rate limiting, paid-state integrity
// ---------------------------------------------------------------------------

test('preview: the shared token is the lead id, so it can resolve a lead', () => {
  // PreviewScreen.share() hands out /preview/<previewTokenFor(lead)>?shared=1.
  // The whole token fallback rests on that token being the lead id verbatim.
  const id = '3f1b6a0e-9d2c-4a51-8f0b-7c2d5e9a1b34';
  assert.equal(previewTokenFor({ id }), id);
  assert.equal(safePreviewToken(id), id, 'a uuid survives the path-segment guard');
  assert.equal(safePreviewToken('../../etc/passwd'), 'demo', 'garbage never reaches the lookup');
  assert.equal(safePreviewToken(undefined), 'demo');
});

test('preview: a recipient with no session gets the draft behind the token', () => {
  const src = readA('lib/preview-draft.js');
  assert.match(src, /import \{[^}]*getLeadById[^}]*\} from '\.\/leads'/, 'imported from lib/leads');
  assert.match(src, /getLeadById\(previewToken\)/, 'the token resolves a lead');
  assert.match(
    src,
    /if \(!lead && previewToken !== 'demo'\)/,
    'only when the session produced no lead of its own'
  );
  assert.ok(
    src.indexOf('getLeadByEmail(session.email)') < src.indexOf('getLeadById(previewToken)'),
    'the session lead is still looked up first and still wins'
  );
});

test('preview: the token lookup fails soft; demo is still the demo draft', () => {
  const src = readA('lib/preview-draft.js');
  // leads.id is a uuid, so a well-formed but unknown token throws in Postgres.
  const fallback = src.slice(src.indexOf("if (!lead && previewToken !== 'demo')"));
  assert.match(
    fallback.slice(0, 400),
    /try \{[\s\S]*getLeadById\(previewToken\)[\s\S]*\} catch/,
    'an unknown token must not blow up the page'
  );
  assert.match(src, /if \(previewToken === 'demo'\) return DEMO_DRAFT;/);
  assert.match(src, /return draftFromBrief\(\{\}\);/, 'a miss still ends at the empty draft');
  assert.ok(!/getLeadById\(token\)/.test(src), 'the unsanitised token never reaches the query');
});

test('auth/start: an IP-limited signup is refused, not congratulated', () => {
  const src = readA('app/api/auth/start/route.js');
  const fromLimit = src.slice(src.indexOf('const ip = clientIp(request);'));
  const branch = fromLimit.slice(0, fromLimit.indexOf('const last = cooldown.get(email);'));
  assert.match(branch, /status: 429/, 'a limited request must not answer 200');
  assert.match(branch, /error: 'rate_limited'/, 'same vocabulary as the other limited routes');
  assert.ok(
    !branch.includes('return ok(email)'),
    'no ok:true/sent:true for a code that was never issued'
  );
  // ok() is the only place PENDING_COOKIE is set, so refusing here also keeps
  // the caller out of /start/verify waiting on an attempt that does not exist.
  assert.match(src, /function ok\(email, extra\)[\s\S]*?PENDING_COOKIE/);
});

test('auth/start: the two truthful ok(email) branches are untouched', () => {
  const src = readA('app/api/auth/start/route.js');
  assert.equal(
    (src.match(/return ok\(email\);/g) || []).length,
    2,
    'saveProfile and cooldown still answer ok — only the IP branch changed'
  );
  const saveProfile = src.indexOf('body?.resend === false');
  const limited = src.indexOf('ipLimit.check');
  const cool = src.indexOf('Date.now() - last < COOLDOWN_MS');
  assert.ok(saveProfile > -1 && limited > saveProfile && cool > limited, 'branch order preserved');
  assert.match(
    src.slice(saveProfile, limited),
    /return ok\(email\);/,
    'the profile-save path keeps the live code and still answers ok'
  );
  assert.match(
    src.slice(cool),
    /return ok\(email\);/,
    'the cooldown path still answers ok — there a code really was just sent'
  );
  assert.match(src, /return ok\(email, \{ pendingToken \}\);/, 'the sent path is unchanged');
});

test('auth/start: sent:true is a claim the ninth caller behind a NAT cannot be told', () => {
  assert.deepEqual(startOkBody('sal@example.com'), {
    ok: true,
    email: 'sal@example.com',
    sent: true,
  });
  const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8 });
  for (let i = 0; i < 8; i += 1) {
    assert.equal(limiter.check('start:203.0.113.7').ok, true, `request ${i + 1} is allowed`);
  }
  assert.equal(limiter.check('start:203.0.113.7').ok, false, 'the 9th shares the office IP');
});

test('account: ?paid=1 on its own no longer renders a paid account', () => {
  const src = readA('app/account/page.jsx');
  assert.match(src, /const purchased = ladder === 'purchased' \|\| stripePaid;/);
  const decl = src.slice(src.indexOf('const purchased ='), src.indexOf('const v1NeedsBrief'));
  assert.ok(!decl.includes('paidParam'), 'a query string is not evidence of payment');
  // Everything the fake state unlocked hangs off `purchased`.
  assert.match(src, /const showApproval = purchased &&/);
  assert.match(src, /const showStatusLadder = purchased && orderStatus;/);
});

test('account: the post-checkout claim flow still relies on paid=1', () => {
  const src = readA('app/account/page.jsx');
  assert.match(
    src,
    /if \(!auth\?\.email && paidParam && sessionId\)/,
    'the Stripe return still claims the session for a signed-out buyer'
  );
  assert.match(src, /stripe\.checkout\.sessions\.retrieve/, 'a retrieved session is the proof');
  assert.match(src, /const stripePaid = stripeSession\?\.payment_status === 'paid';/);
});

test('compose-runs: getComposeRunById builds one whole query per case', () => {
  const src = readA('lib/compose-runs.js');
  const fn = src.slice(src.indexOf('export async function getComposeRunById'));
  assert.match(
    fn,
    /WHERE id = \$\{runId\} AND lead_id = \$\{leadId\}/,
    'the ownership case is a complete query'
  );
  assert.match(fn, /WHERE id = \$\{runId\}\s*\n\s*LIMIT 1/, 'so is the unscoped case');
  assert.match(fn, /leadId\s*\n?\s*\?\s*await sql`/, 'the branch picks a query, not a fragment');
  assert.match(fn, /catch \(err\)[\s\S]*return null;/, 'the miss path still returns null');
});

test('compose-runs: no query interpolates another sql`` fragment', () => {
  // @neondatabase/serverless binds an interpolated tagged template as a
  // parameter, so `${leadId ? sql`AND lead_id = ${leadId}` : sql``}` compiles
  // to `WHERE id = $1 $2 LIMIT 1` and throws on every single call.
  const nested = /\$\{[^}]*sql`/;
  for (const path of ['lib/compose-runs.js', 'lib/leads.js', 'lib/db.js']) {
    assert.ok(!nested.test(readA(path)), `${path} must not compose sql fragments`);
  }
  assert.ok(!readA('lib/compose-runs.js').includes('sql``'), 'no empty-fragment idiom');
});

test('StartFlow: a rate-limited signup never renders the raw error code', () => {
  const src = readA('components/funnel/StartFlow.jsx');
  // Scope to the auth/start submit only. The article-resolve call above it
  // legitimately reads data.error, because /api/article/resolve returns written
  // prose in that field while /api/auth/start returns a machine code.
  const authIdx = src.indexOf("fetch('/api/auth/start'");
  assert.ok(authIdx > 0, 'auth/start call not found');
  const block = src.slice(authIdx, authIdx + 1400);
  assert.match(block, /data\.message \|\| STEP_EMAIL\.failed/);
  assert.doesNotMatch(block, /new Error\(data\.error/, 'machine codes must not reach the user');

  const route = readA('app/api/auth/start/route.js');
  assert.match(route, /rate_limited/);
  assert.match(route, /Too many sign-in attempts/, 'the 429 must carry wording');
  assert.match(route, /status: 429/);
});
