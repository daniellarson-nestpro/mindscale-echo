export function briefSavedBody() {
  return { saved: true };
}

export const BRIEF_FORM_FIELDS = [
  'companyName',
  'website',
  'contactName',
  'contactEmail',
  'phone',
  'announcementType',
  'quote',
  'quoteAttribution',
  'notes',
];

export function leadToBriefJson(lead) {
  if (!lead) return { brief: null };
  return {
    brief: {
      companyName: lead.company_name || '',
      website: lead.website || '',
      contactName: lead.contact_name || '',
      contactEmail: lead.email || '',
      phone: lead.phone || '',
      announcementType: lead.announcement_type || '',
      articleUrl: lead.article_url || '',
      articleText: lead.article_text || '',
      quote: lead.quote || '',
      quoteAttribution: lead.quote_attribution || '',
      notes: lead.notes || '',
    },
  };
}

function wordCount(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function sourcesFromBrief(brief) {
  if (!brief || typeof brief !== 'object') return [];
  const sources = [];
  const articleUrl = String(brief.articleUrl || '').trim();
  const articleText = String(brief.articleText || '').trim();
  if (articleUrl) {
    sources.push({
      type: 'url',
      value: articleUrl,
      display: articleUrl,
    });
  }
  if (articleText) {
    sources.push({
      type: 'text',
      value: articleText,
      display: 'Article text',
      meta: `${wordCount(articleText)} words`,
    });
  }
  return sources;
}

export function briefToFormState(brief) {
  const values = {};
  for (const key of BRIEF_FORM_FIELDS) {
    values[key] = typeof brief?.[key] === 'string' ? brief[key] : '';
  }
  return { values, sources: sourcesFromBrief(brief) };
}

/** Shape BriefForm accepts as `initial` (values plus sources). */
export function initialFromBrief(brief) {
  if (!brief) return {};
  const { values, sources } = briefToFormState(brief);
  return { ...values, sources };
}

export function hasResumableBrief(brief) {
  if (!brief || typeof brief !== 'object') return false;
  if (BRIEF_FORM_FIELDS.some((key) => String(brief[key] || '').trim())) return true;
  return Boolean(String(brief.articleUrl || '').trim() || String(brief.articleText || '').trim());
}

export function mergeBriefFormState(current = {}, incoming = {}) {
  const nextValues = { ...(current.values || {}) };
  for (const key of BRIEF_FORM_FIELDS) {
    const value = incoming.values?.[key];
    if (String(value || '').trim()) nextValues[key] = value;
  }
  const incomingSources = Array.isArray(incoming.sources) ? incoming.sources : [];
  const currentSources = Array.isArray(current.sources) ? current.sources : [];
  return {
    values: nextValues,
    sources: incomingSources.length ? incomingSources : currentSources,
  };
}
