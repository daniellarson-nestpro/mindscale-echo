import { parsePublicHttpUrl } from './ssrf.js';

const MAX = {
  companyName: 200,
  contactName: 200,
  phone: 40,
  quote: 2000,
  articleUrl: 2000,
  email: 254,
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function cleanPhone(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX.phone) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  if (!/^[+\d][\d\s().-]{6,39}$/.test(trimmed)) return '';
  return trimmed;
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return '';
  return trimmed;
}

function cleanArticleUrl(value) {
  const trimmed = cleanText(value, MAX.articleUrl);
  if (!trimmed) return '';
  const parsed = parsePublicHttpUrl(trimmed);
  if (parsed.error) return '';
  return parsed.url.href;
}

/**
 * Garbage fields are dropped silently. Does not create an account.
 */
export function sanitizePrefill(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const params = source.params && typeof source.params === 'object' ? source.params : source;
  const out = {};

  const email = normalizeEmail(params.email);
  if (EMAIL_PATTERN.test(email) && email.length <= MAX.email) out.email = email;

  const companyName = cleanText(params.companyName, MAX.companyName);
  if (companyName) out.companyName = companyName;

  const contactName = cleanText(params.contactName, MAX.contactName);
  if (contactName) out.contactName = contactName;

  const phone = cleanPhone(params.phone);
  if (phone) out.phone = phone;

  const quote = cleanText(params.quote, MAX.quote);
  if (quote) out.quote = quote;

  const articleUrl = cleanArticleUrl(params.articleUrl);
  if (articleUrl) out.articleUrl = articleUrl;

  return out;
}

export function prefillToLeadFields(prefill) {
  if (!prefill) return {};
  const fields = {};
  if (prefill.contactName) fields.contactName = prefill.contactName;
  if (prefill.phone) fields.phone = prefill.phone;
  if (prefill.companyName) fields.companyName = prefill.companyName;
  if (prefill.articleUrl) fields.articleUrl = prefill.articleUrl;
  if (prefill.quote) fields.quote = prefill.quote;
  return fields;
}
