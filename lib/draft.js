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
  primarySub: (price, day) => `${price} — goes out ${day}`,
  secondary: 'Change something',
  share: 'Send this draft to someone',
  shareSub: 'Read-only link. They don’t need an account.',
  shareCopied: 'Link copied — paste it wherever.',
  humanNote: 'A person reads every release before it goes out.',
  approveNotice: 'Approve this draft first, then you can send it out.',
  approveNext: 'Approve the draft above, then send it out.',
  approvedReady: 'Approved. You can send it out when you’re ready.',
  approveSignIn: 'Sign in to approve this draft, then you can send it out.',
  approveOwner: 'The account holder needs to approve this draft before it can be sent out.',
};

export const ACCOUNT = {
  h1: 'Your releases',
  cardEyebrow: 'Purchased',
  cardTitle: 'It’s out.',
  cardBody:
    'Your release is sending. Approve-to-send is instant. Full distribution takes 1–2 business days. Placement links will show in your workspace.',
  readIt: 'Read it',
  sendIt: 'Send it out',
  start: 'Start a release',
  continue: 'Continue your brief',
  empty: 'Nothing sent yet. Start a release when you’re ready.',
  draftEyebrow: 'Draft ready',
  draftTitle: 'Your draft is ready.',
  draftBody: 'Read it, approve it, then send it out when you’re ready.',
  inProgressTitle: 'Brief in progress',
  inProgressBody: 'Pick up where you left off — nothing has been sent.',
};

export const CHECKOUT = {
  eyebrow: 'Last step',
  h1: 'Last step. Pick how far it goes.',
  sub: 'You already approved the draft. Payment sends it.',
  underButtons:
    'One payment. No subscription. We send instantly after you approve. Full distribution takes 1–2 business days. Daily cutoff is 2pm CST.',
  consent: 'By paying you agree to the',
  bookerLine: 'Rather talk it through with a person first?',
  bookerCta: 'Book 30 minutes',
  bookerPromoted:
    'Not sure which one? Grab 30 minutes with us — we’ll look at your article and tell you which package to use, or whether to wait for a better story.',
  basicLine: 'Named national URLs.',
  premiumLine: 'Named URLs plus AIWire.',
  premiumTag: 'Recommended',
};

export const SUCCESS = {
  h1: 'It’s out.',
  body: 'Your release is sending. Approve-to-send is instant. Full distribution takes 1–2 business days. Placement links will show in your workspace. Log in with the email from your receipt.',
  cta: 'Open your workspace',
};

export const CANCEL = {
  h1: 'Checkout cancelled. No charge.',
  body: 'Nothing was sent. Send the article whenever you’re ready.',
  cta: 'Return to packages',
};

export const CALL = {
  h1: 'Grab 30 minutes.',
  body: 'We’ll look at your article and tell you which package to use — or whether to wait for a better story.',
  fallback: 'Email us and we’ll find a time.',
};

/** The distribution partner's daily cutoff: 2pm Central, business days only. */
const SEND_TZ = 'America/Chicago';
const SEND_CUTOFF_HOUR = 14;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function chicagoParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEND_TZ,
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Monday';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  return { weekday: WEEKDAYS.indexOf(weekday), hour };
}

/**
 * When a release approved right now goes out: "today" before the 2pm CST
 * cutoff on a business day, otherwise the next business day by name.
 */
export function sendDayLabel(from = new Date()) {
  const { weekday, hour } = chicagoParts(from);
  const businessDay = weekday >= 1 && weekday <= 5;
  if (businessDay && hour < SEND_CUTOFF_HOUR) return 'today';
  let next = (weekday + 1) % 7;
  while (next === 0 || next === 6) next = (next + 1) % 7;
  return WEEKDAYS[next];
}
