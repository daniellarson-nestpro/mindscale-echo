/**
 * Draft shape + copy for the preview and checkout screens.
 *
 * draftFromBrief maps a saved lead into this shape when n8n has not
 * succeeded yet. DEMO_DRAFT is last-resort only: unauthenticated
 * `/preview/demo` with no lead.
 */

function clip(value, max) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

function paragraphsFromArticle(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.length > 1 ? lines : [raw.replace(/\s+/g, ' ')];
}

function honestBody({ companyName, website, announcementType, notes, articleUrl }) {
  const sentences = [];
  if (companyName && announcementType) {
    sentences.push(`${companyName} is announcing ${announcementType}.`);
  } else if (companyName) {
    sentences.push(`${companyName} has news to share.`);
  } else if (announcementType) {
    sentences.push(`This release is about ${announcementType}.`);
  }
  if (website) sentences.push(`More at ${website}.`);
  if (articleUrl && !sentences.some((s) => s.includes(articleUrl))) {
    sentences.push(`Coverage: ${articleUrl}.`);
  }
  if (notes) sentences.push(notes);
  if (!sentences.length) {
    sentences.push('A draft will be written from the brief. Nothing has been invented here.');
  }
  return sentences.slice(0, 3);
}

function headlineFromBrief(brief) {
  const companyName = clip(brief?.companyName, 200);
  const announcementType = clip(brief?.announcementType, 80);
  if (companyName && announcementType) return `${companyName} announces ${announcementType}`;
  if (companyName) return companyName;
  if (announcementType) return announcementType;
  return 'Draft release';
}

export function hasRealBrief(brief) {
  if (!brief || typeof brief !== 'object') return false;
  return Boolean(
    clip(brief.companyName, 200) ||
      clip(brief.website, 400) ||
      clip(brief.contactName, 200) ||
      clip(brief.announcementType, 80) ||
      clip(brief.articleUrl, 2000) ||
      clip(brief.articleText, 50000) ||
      clip(brief.quote, 2000) ||
      clip(brief.notes, 5000)
  );
}

export function checkoutSummaryFromBrief(brief) {
  if (!hasRealBrief(brief)) return 'Draft ready';
  const companyName = clip(brief.companyName, 200);
  const announcementType = clip(brief.announcementType, 80);
  return [companyName, announcementType || 'Draft ready'].filter(Boolean).join(' · ');
}

/**
 * Map a saved lead/brief into the preview draft shape without calling n8n.
 * Honest fields only — no Sal’s Pizza, no fake dateline city, no invented coverage.
 */
export function draftFromBrief(brief, now = new Date()) {
  const companyName = clip(brief?.companyName, 200);
  const website = clip(brief?.website, 400);
  const contactName = clip(brief?.contactName, 200);
  const contactEmail = clip(brief?.contactEmail, 254);
  const phone = clip(brief?.phone, 40);
  const quote = clip(brief?.quote, 2000);
  const quoteAttribution = clip(brief?.quoteAttribution, 200) || contactName;
  const announcementType = clip(brief?.announcementType, 80);
  const articleText = clip(brief?.articleText, 50000);
  const articleUrl = clip(brief?.articleUrl, 2000);
  const notes = clip(brief?.notes, 5000);

  const dateline = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  let bodyParagraphs = paragraphsFromArticle(articleText);
  if (!bodyParagraphs.length) {
    bodyParagraphs = honestBody({ companyName, website, announcementType, notes, articleUrl });
  }

  let boilerplate;
  if (companyName && website) {
    boilerplate = notes ? `${companyName} (${website}). ${notes}` : `${companyName} is at ${website}.`;
  } else if (companyName) {
    boilerplate = notes || `${companyName} is their business.`;
  } else {
    boilerplate = notes || 'This is their business.';
  }
  boilerplate = clip(boilerplate, 500);

  return {
    companyName: companyName || 'Your business',
    website,
    logoUrl: null,
    headline: headlineFromBrief(brief),
    subhead: '',
    dateline,
    bodyParagraphs,
    quote,
    quoteAttribution,
    boilerplate,
    contactName,
    contactEmail,
    phone,
  };
}

export const DEMO_DRAFT = {
  companyName: 'Sal’s Pizza & Pasta',
  website: 'salspizza.com',
  logoUrl: null,
  headline: 'Sal’s Pizza & Pasta to Open Second Location on Third Street',
  subhead:
    'Family-run Grandview restaurant expands after eleven years, adding 22 jobs and a dedicated pickup counter.',
  dateline: 'GRANDVIEW, OH — September 3, 2026',
  bodyParagraphs: [
    'Sal’s Pizza & Pasta today announced it will open a second location at 418 Third Street this fall, expanding the family-run restaurant beyond the Grandview storefront it has operated since 2015.',
    'The new location will seat 64 and add a dedicated pickup counter built for the takeout volume that now accounts for more than half of the restaurant’s orders. The expansion is expected to create 22 positions, with hiring beginning in October.',
    'The restaurant was featured in The Herald-Tribune in August following a run of local recognition for its Sunday gravy, a recipe owner Sal Marino attributes to his grandmother.',
    'The Third Street location is scheduled to open in November. The original Grandview location will continue operating unchanged.',
  ],
  quote:
    'We’ve been feeding this neighborhood eleven years. Opening on Third Street means we get to do it for a whole new set of regulars.',
  quoteAttribution: 'Sal Marino, Owner',
  boilerplate:
    'Sal’s Pizza & Pasta is a family-owned restaurant in Grandview, Ohio, serving hand-tossed pizza and house-made pasta since 2015. The restaurant is owned and operated by the Marino family.',
  contactName: 'Sal Marino',
  contactEmail: 'sal@salspizza.com',
  phone: '(312) 555-0148',
};

export const PREVIEW = {
  eyebrow: 'Draft — nothing sent yet',
  h1: 'Read it before you decide.',
  sub: 'Every fact here came from your brief. It hasn’t gone anywhere.',
  accountNote: 'Saved to your account. You can come back to this draft any time.',
  plateCaption: 'This is how it goes out — on your letterhead',
  primary: 'Send it out',
  primarySub: (price, day) => `${price} — goes out ${day} morning`,
  secondary: 'Change something',
  share: 'Send this draft to someone',
  shareSub: 'Read-only link. They don’t need an account.',
  shareCopied: 'Link copied — paste it wherever.',
  humanNote: 'A person reads every release before it goes out.',
};

export const ACCOUNT = {
  h1: 'Your releases',
  cardEyebrow: 'Purchased',
  cardTitle: 'On its way out.',
  cardBody: 'We’ll email you as placements come in.',
  readIt: 'Read it',
  sendIt: 'Send it out',
  start: 'Start a release',
  continue: 'Continue your brief',
  empty: 'Nothing sent yet. Start a release when you’re ready.',
  draftEyebrow: 'Draft ready',
  draftTitle: 'Your draft is ready.',
  draftBody: 'Read it, then send it out when you’re ready.',
  inProgressTitle: 'Brief in progress',
  inProgressBody: 'Pick up where you left off — nothing has been sent.',
};

export const CHECKOUT = {
  eyebrow: 'Last step',
  h1: 'Pick how far it goes.',
  underButtons: 'One payment. No subscription. Card handled by Stripe — we never see it.',
  bookerLine: 'Rather talk it through with a person first?',
  bookerCta: 'Book 30 minutes',
  bookerPromoted:
    'Not sure which one? Grab 30 minutes with us — we’ll look at your article together and tell you straight which tier makes sense. There’s no pitch.',
  basicLine: 'Written, formatted, and sent out across the media network.',
  premiumLine: 'Everything in Basic, plus AI search surfaces and podcast distribution.',
  premiumTag: 'Most owners pick this',
};

/** Next business-day-ish send date, for the CTA sub-label. */
export function nextSendDay(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}
