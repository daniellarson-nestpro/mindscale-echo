/**
 * Prompts and schemas for the two-stage press-release composer.
 *
 * Stage 1 extracts structured facts from the customer's article clip. Stage 2
 * writes the release from those facts ALONE — the clip is deliberately withheld
 * from the writer. That separation is the point: it is what stops the model
 * paraphrasing a journalist's prose or inventing details about a real business,
 * and it must survive any edit to the text below.
 *
 * Ported from the "Press Release Composer (Webhook)" n8n workflow.
 *
 * The two INSTRUCTIONS blocks are the prompt owner's to edit (via the Notion
 * sync). The two SCHEMAS are not: they are the contract the code parses against,
 * and stage 2's prompt is only correct with respect to stage 1's schema.
 */

/* --- BEGIN SYNCED: facts-instructions --- */
export const FACTS_INSTRUCTIONS = `You are a news desk fact checker. Mine the clip for WHO/WHAT/WHERE/WHEN/WHY only. Do not write a press release. Do not paraphrase the article into paragraphs. Output structured facts only.

Record the location precisely enough to build a dateline (city and state or region) whenever the clip supports it. Put it in \`where\`.

If the clip does not contain enough to identify a real event, set ok:false with a short error and leave the fact fields empty.`;
/* --- END SYNCED: facts-instructions --- */

/* --- BEGIN SYNCED: draft-instructions --- */
export const DRAFT_INSTRUCTIONS = `You write wire-ready press releases from STRUCTURED FACTS only.

The previous step already extracted who/what/where/when/why and keyFacts. Your job is composition — not extraction and not summarization of an article.

HARD RULES
- Use only input.facts and the supplied company/contact fields.
- Never invent dates, addresses, awards, stats, motives, or quotes.
- Do not write feature-story color, folklore, or scenic digressions.
- Original sentences only. Verbatim allowed solely for customer-supplied quote fields.
- articleText is intentionally absent. Never ask for it and never reconstruct narrative from it.

USING THE CUSTOMER'S OWN INPUT
- announcementType is what the customer said this news is (for example a new location, a hire, an award). Let it shape the angle and the headline. It is their stated intent, not a fact to assert.
- notes are the customer's own remarks. Treat them as supplied context you may draw on, at the same level of trust as the quote fields. Never treat them as reported fact if they conflict with input.facts.

OUTPUT
- ok:true with error:null when you can write it; else ok:false with error.
- headline: company + action. No hype, no exclamation, no trailing period.
- subhead: one advancing fact, or empty.
- dateline: CITY, ST, Month Day, Year — only if clearly supported; else empty.
- body: 3–5 short inverted-pyramid paragraphs (array of strings).
- quote/quoteAttribution/boilerplate/contactLine from supplied fields + supported facts.

VOICE
Never mention extraction, schemas, prompts, or 'provided facts'. Write as a normal wire release. If a person name is only weakly supported, omit it rather than hedging.`;
/* --- END SYNCED: draft-instructions --- */

/** Stage 1 output contract. */
export const FACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'who', 'what', 'where', 'when', 'why', 'keyFacts', 'discarded', 'error'],
  properties: {
    ok: { type: 'boolean' },
    who: { type: 'string' },
    what: { type: 'string' },
    where: { type: 'string' },
    when: { type: 'string' },
    why: { type: 'string' },
    keyFacts: { type: 'array', items: { type: 'string' } },
    discarded: { type: 'string' },
    error: { type: ['string', 'null'] },
  },
};

/** Stage 2 output contract. Mirrors what normalizeComposeResponse reads. */
export const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ok',
    'headline',
    'subhead',
    'dateline',
    'body',
    'quote',
    'quoteAttribution',
    'boilerplate',
    'contactLine',
    'error',
  ],
  properties: {
    ok: { type: 'boolean' },
    headline: { type: 'string' },
    subhead: { type: 'string' },
    dateline: { type: 'string' },
    body: { type: 'array', items: { type: 'string' } },
    quote: { type: 'string' },
    quoteAttribution: { type: 'string' },
    boilerplate: { type: 'string' },
    contactLine: { type: 'string' },
    error: { type: ['string', 'null'] },
  },
};

const str = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

/**
 * Stage 1 input. The fact extractor sees the clip and the customer's framing,
 * but not our internal identifiers — leadId/orderId/composeRunId are plumbing
 * and only add noise to the context.
 */
export function buildFactsInput(payload = {}) {
  return {
    companyName: str(payload.companyName),
    website: str(payload.website),
    contactName: str(payload.contactName),
    announcementType: str(payload.announcementType),
    articleSource: str(payload.articleSource),
    articleText: str(payload.articleText),
    quote: str(payload.quote),
    quoteAttribution: str(payload.quoteAttribution),
    notes: str(payload.notes),
  };
}

/**
 * Stage 2 input. Facts plus customer-supplied fields — and `articleText` is
 * explicitly blanked rather than omitted, so that a prompt which still mentions
 * it reads an empty string instead of silently inheriting the clip from context.
 *
 * announcementType and notes are included deliberately: the n8n workflow
 * collected both from the customer, logged announcementType, and passed neither
 * to the writer, so a required brief field never reached the release.
 */
export function buildDraftInput(payload = {}, facts = {}) {
  return {
    companyName: str(payload.companyName),
    website: str(payload.website),
    contactName: str(payload.contactName),
    contactEmail: str(payload.contactEmail),
    phone: str(payload.phone),
    announcementType: str(payload.announcementType),
    notes: str(payload.notes),
    quote: str(payload.quote),
    quoteAttribution: str(payload.quoteAttribution),
    orderId: str(payload.orderId),
    facts: {
      who: str(facts.who),
      what: str(facts.what),
      where: str(facts.where),
      when: str(facts.when),
      why: str(facts.why),
      keyFacts: Array.isArray(facts.keyFacts) ? facts.keyFacts.map(str) : [],
      discarded: str(facts.discarded),
    },
    articleText: '',
  };
}
