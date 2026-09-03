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
import { inferStepFromLead, ladderState, pathForStep, resolveFurthestStep } from '../lib/progress.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { isPrivateIPv4, isPrivateIp, parsePublicHttpUrl } from '../lib/ssrf.js';
import { parseArticleHtml } from '../lib/article-html.js';
import { cleanPhone, mergeStartLeadFields, sanitizeContext, sanitizePrefill } from '../lib/prefill-fields.js';
import { formatChipDate, normalizeArticleInput, toHyperagentArticle } from '../lib/article-shape.js';
import { briefSavedBody, leadToBriefJson } from '../lib/brief-shape.js';

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
