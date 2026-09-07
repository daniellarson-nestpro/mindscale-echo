/**
 * Funnel copy — every human-facing string in the account → brief → checkout
 * flow. Written for business owners (restaurants, retail, trades, clinics),
 * not founders or marketers.
 *
 * Field `name` attributes are locked and live in the components; only this
 * text changes. Compliance wording is deliberately untouched.
 */

export const SUPPORT_EMAIL = 'hello@mindscalepartners.com';

/* ---------- Step 0: the article ---------- */

export const STEP_ARTICLE = {
  eyebrow: 'Step 1 of 3',
  h1: 'Got written up? Let’s get it everywhere else.',
  sub: 'Paste the article text or upload a PDF.',
  label: 'News article or announcement',
  placeholder: 'Paste the article text here…',
  hint: 'PDF or pasted text only. Minimum 100 characters of article content.',
  dropHint: 'Paste the article text or drop the PDF — whatever you have.',
  ambiguous: 'Please paste the full article text (URLs are not supported for V1).',
  addAnother: '+ Add another source',
  noArticle: 'No article yet — I’ve got news to announce',
  // StartFlow reads both of these when /api/article/resolve cannot read a link.
  // They were referenced but never defined, so a failed resolve rendered an
  // empty error and an empty chip caption.
  parseFail: 'We couldn’t read that link. Paste the article text instead and we’ll take it from there.',
  parsePartial: 'Link added — we couldn’t read the details',
  cta: 'Continue',
};

export const MILESTONES = [
  { value: 'Second location', label: 'We opened a second location' },
  { value: 'Grand opening', label: 'We’re having a grand opening' },
  { value: 'Expansion or remodel', label: 'We’re expanding or remodeling' },
  { value: 'Award or best of', label: 'We won an award' },
  { value: 'New hire', label: 'We hired someone new' },
  { value: 'Milestone', label: 'We hit a milestone' },
  { value: 'Something else', label: 'Something else' },
];

export const STEP_MILESTONE = {
  h1: 'What’s the news?',
  otherLabel: 'Tell us in a few words',
  otherPlaceholder: 'We’re celebrating 25 years in business',
  backToArticle: 'Actually, I do have an article',
};

/* ---------- Step 1: email ---------- */

export const STEP_EMAIL = {
  eyebrow: 'Step 2 of 3',
  h1: 'Let’s make sure we can reach you.',
  sub: 'We’ll email you a 6-digit code. No password to make up or forget.',
  label: 'Your email',
  placeholder: 'sal@salspizza.com',
  cta: 'Send my code',
  ctaLoading: 'Sending…',
  reassure: 'You’re not buying anything yet.',
  priceLine: '$499 or $699 · one time · nothing until you’ve read the draft',
  promise: 'You’ll read the whole release before you pay anything. Payment is for sending it out.',
  invalid: 'That address looks like it’s missing something — mind checking it?',
  empty: 'We need an email to send your draft to.',
  failed: 'Our end hiccuped. Try that once more?',
  changeArticle: 'Change the article',
};

/* ---------- Verify ---------- */

export const VERIFY = {
  h1: 'Check your email.',
  sub: (email) => `We sent a 6-digit code to ${email} — type it below.`,
  linkNote: 'The same email has a sign-in link, if you’d rather just tap that.',
  changeEmail: 'Wrong address? Change it',
  codeLabel: 'Your code',
  codePlaceholder: '6 digits',
  expiryNote: 'Codes are good for 20 minutes.',
  spamNudge: `Nothing yet? Check your spam or promotions folder — look for ${SUPPORT_EMAIL}. Or resend the code.`,
  resend: 'Send it again',
  resendWait: (s) => `Send it again (${s})`,
  wrongCode: 'That code isn’t matching. Codes expire after 20 minutes — try a fresh one.',
  expiredH1: 'That code timed out.',
  expiredSub: 'No trouble — we’ve sent you a new one.',
  waitHeading: 'While that’s landing —',
  nameLabel: 'Your name',
  namePlaceholder: 'Sal Marino',
  phoneLabel: 'Best number for you',
  phoneOptional: '(optional)',
  phonePlaceholder: '(312) 555-0148',
  phoneHint:
    'Only so we can call if a reporter has a question about your release. We don’t sell it and we don’t cold-call.',
  verified: 'You’re in.',
};

/* ---------- Brief ---------- */

export const BRIEF = {
  eyebrow: 'Step 3 of 3',
  h1: 'Tell us about the business.',
  sub: 'Ten minutes, tops. Everything saves as you go — close the tab and come back whenever.',
  savedIdle: 'Saved',
  saving: 'Saving…',
  saveFailed: 'Couldn’t save that just now — we’ll keep trying. Don’t close the tab yet.',
  resume: 'Picked up right where you left off.',
  cta: 'See my draft',
  ctaLoading: 'Writing your release…',
  missing: 'A couple of things still to fill in — we’ve marked them.',
  saveLater: 'Save and finish later',
  saveLaterDone: 'Saved. We’ve emailed you a link back to this page.',
  articleMissing:
    'Paste the article text (at least a few paragraphs) so we have something to write from. A PDF file by itself isn’t enough yet.',
  sections: [
    { id: 'business', label: 'The business' },
    { id: 'news', label: 'The news' },
    { id: 'words', label: 'In your words' },
  ],
};

/** Preview “Change something” — V2 brief, news section. Never /login. */
export const BRIEF_EDIT_HREF = '/brief#news';

export const FIELDS = {
  companyName: {
    label: 'Business name',
    placeholder: 'Sal’s Pizza & Pasta',
    hint: 'Exactly how you want it printed.',
    empty: 'We need the business name for the release.',
  },
  website: {
    label: 'Website',
    placeholder: 'salspizza.com',
    hint: 'No website? Your Facebook or Instagram page is fine.',
    invalid: 'Try it without the https:// — just salspizza.com.',
  },
  logo: {
    label: 'Your logo',
    hint: 'A clear photo of your sign works if that’s all you’ve got. We’ll tidy it up.',
    drop: 'Drop it here, or pick a file',
    tooBig: `That file’s a bit big for us to handle. If it’s a photo, try taking it again with less zoom — or send it to ${SUPPORT_EMAIL} and we’ll add it for you.`,
    wrongType: 'We need an image file — PNG, JPG, or WebP.',
    replace: 'Change it',
  },
  contactName: {
    label: 'Who should reporters ask for?',
    placeholder: 'Sal Marino',
    hint: 'Usually the owner or manager.',
  },
  contactEmail: {
    label: 'Where should we send the draft?',
    placeholder: 'sal@salspizza.com',
    invalid: 'That address looks a bit off — worth a second look.',
  },
  phone: {
    label: 'Contact phone',
    placeholder: '(312) 555-0148',
    hint: 'Goes on the release so reporters can follow up. Leave it blank if you’d rather they email.',
  },
  article: {
    label: 'The write-up',
    placeholder: 'Paste a link, drop a PDF, or paste the text',
  },
  announcementType: {
    label: 'What are we announcing?',
  },
  notes: {
    label: 'Anything else we should know?',
    toggle: 'Add a note for the writer',
    placeholder:
      'We’re closed Mondays. The new place opens the 14th. Please don’t mention the old Elm Street shop.',
    hint: 'Dates, spellings, things to leave out. The more you tell us, the less back-and-forth.',
  },
  quote: {
    label: 'Say something about it',
    placeholder:
      'We’ve been feeding this neighborhood eleven years. Opening on Third Street means we get to do it for a whole new set of regulars.',
    hint: 'Every release needs a line from a person. Talk like you’d talk to a customer — we’ll tidy up the grammar, not the voice.',
  },
  quoteAttribution: {
    label: 'Who’s saying it?',
    placeholder: 'Sal Marino, Owner',
    hint: 'Name and title, as you’d want it printed.',
  },
};

export const ANNOUNCEMENT_CHIPS = [
  'Second location',
  'Grand opening',
  'Expansion or remodel',
  'Award or “best of”',
  'New hire',
  'Milestone',
  'Community write-up',
  'Something else',
];

/* ---------- Compose wait ---------- */

export const COMPOSE = {
  stages: ['Reading your notes…', 'Writing your announcement…', 'Setting it on your letterhead…'],
  slowH: 'Still writing — this one’s taking a little longer than usual. Hang on another moment.',
  slowSub: 'You can close this page if you need to. We’ll email your draft the second it’s ready.',
  failH: 'Something went wrong on our end — not yours.',
  failSub: 'Your answers are all saved. Give it another go?',
  failCta: 'Try again',
  failHelp: `Still stuck? Email ${SUPPORT_EMAIL} and we’ll write it by hand.`,
  /**
   * Fallback wording for compose error codes. The API sends a written `message`
   * with its 422s and that always wins; this covers the transport failures that
   * only carry a code, so the customer never reads a raw identifier.
   */
  errors: {
    timeout: 'The writer took too long to respond. Your brief is saved — try again in a moment.',
    network: 'We couldn’t reach the writer just now. Your brief is saved — try again in a moment.',
    unavailable: 'That service is briefly unavailable. Your brief is saved — try again in a moment.',
    refused: 'We couldn’t write a release from this article. Try adding more of the article text, or email us and we’ll do it by hand.',
  },
};
