/** All marketing copy lives here so it can be edited without touching layout. */

export const BRAND = {
  name: 'Mindscale Echo',
  parent: 'Mindscale Partners',
  eyebrow: 'Local coverage → national URLs',
  headline: ['You already made the news.', 'Now make it'],
  headlineAccent: 'everywhere',
  subheadline:
    'Send us your local article. We write the press release. You read the full draft. Then we place it — live, indexable URLs on AP News, Business Insider, and Yahoo Finance.',
  primaryCta: 'Send the article',
  secondaryCta: 'See a real placement',
  trustLine: 'You approve the draft before you pay.',
  urgency: 'A local article is most valuable within 30 days of publication.',
  logoStripCaption: 'Live URLs on these outlets after you approve.',
};

/** Where every "Send the article" button goes. Stripe never opens from here. */
export const START_HREF = '/start';

/**
 * A real, live placement for the hero's "See a real placement" button. Empty
 * means the button is not rendered at all — never point it at a mock.
 */
export const PLACEMENT_URL = '';

/* ---------- Scale strip ---------- */

export const SCALE = [
  {
    value: 300,
    suffix: '+',
    label: 'Outlet distribution — Basic',
  },
  {
    value: 500,
    suffix: '+',
    label: 'Outlet distribution — Premium',
  },
];

/** Outlets the customer gets a live URL on. Named, not decorative. */
export const MEDIA_BADGES = [
  'AP News',
  'Business Insider',
  'Yahoo Finance',
  'StreetInsider',
  'Benzinga',
];

export const AI_BADGES = ['ChatGPT', 'Perplexity', 'Gemini', 'Copilot', 'Grok'];

/* ---------- The trophy: what the customer walks away holding ---------- */

export const TROPHY = {
  eyebrow: 'What you walk away with',
  headline: 'Your name, on the mastheads buyers already trust.',
  copy: 'Every release comes with a badge kit and the placement links behind it — ready for your site, your deck, and your next sales call.',
  disclaimer: 'Illustrative example. Your placement links are the proof.',
  siteName: 'Northline Coffee Co.',
  siteTag: 'Second location now open in Grandview',
  badgeLine: ['AP News', 'Business Insider', 'Yahoo Finance'],
};

/* ---------- How it works ---------- */

export const HOW_IT_WORKS = {
  headline: ['Send it. We write it. You approve.', 'It goes out.'],
  note: 'A local article is most valuable within 30 days of publication.',
};

export const STEPS = [
  { n: '01', title: 'Send it', copy: 'Your local article, announcement, or milestone.' },
  {
    n: '02',
    title: 'We write it',
    copy: 'A professional release, back to you in 2 business days.',
  },
  {
    n: '03',
    title: 'You approve',
    copy: 'You read the whole draft. You don’t pay until you do.',
  },
  {
    n: '04',
    title: 'It goes out',
    copy: 'We send the minute you approve. Full distribution takes 1–2 business days. Daily cutoff is 2pm CST. Live URLs on AP News, Business Insider, and Yahoo Finance, plus your badge kit.',
  },
];

/* ---------- Pricing ---------- */

export const PRICING = {
  eyebrow: 'Packages',
  headline: ['Pay per release. No retainer.', 'Pay after you approve the draft.'],
  underCards:
    'Secure checkout by Stripe. You approve before you pay. Draft back within 2 business days. We send instantly after you approve. Full distribution takes 1–2 business days. Daily cutoff is 2pm CST.',
  guarantee:
    'After you approve, if the AP News, Business Insider, and Yahoo Finance URLs are not live within 14 days, we resend free or refund you.',
  timing:
    'Approve before 2pm CST and it goes out the same day. After 2pm CST, it goes out the next business day. Full distribution takes 1–2 business days.',
};

/* ---------- Dashboard preview ---------- */

export const DASHBOARD_STATS = [
  { label: 'Reported placements', value: '184' },
  { label: 'Indexed publisher pages', value: '97' },
  { label: 'AI surfaces monitored', value: '5' },
];

/* ---------- FAQ ---------- */

export const FAQ = [
  {
    q: 'What is Mindscale Echo?',
    a: 'We turn your local article into a press release, you approve it, then we place it. You get live URLs on AP News, Business Insider, and Yahoo Finance, plus badge files.',
  },
  {
    q: 'Who is this for?',
    a: 'Businesses with an article or dated milestone in the last 30 days.',
  },
  {
    q: 'Do I need a news article?',
    a: 'A recent article is best. You can also send a milestone. Coverage is most valuable within 30 days.',
  },
  {
    q: 'Will I get AP News, Business Insider, and Yahoo Finance?',
    a: 'Yes. After you approve, you get live, indexable URLs on those outlets.',
  },
  {
    q: 'What does Premium add?',
    a: 'More outlets, StreetInsider, Benzinga, AIWire, and an AI visibility report.',
  },
  {
    q: 'Do I pay before I see the draft?',
    a: 'No. You read the full release first. You pay to send it.',
  },
  {
    q: 'When does it go out?',
    a: 'The minute you approve. Approve before 2pm CST and it sends the same day. After 2pm CST, next business day. Full distribution takes 1–2 business days.',
  },
  {
    q: 'What if the URLs don’t go live?',
    a: 'If the AP News, Business Insider, and Yahoo Finance URLs are not live within 14 days of send, we resend free or refund you.',
  },
  {
    q: 'Do I get “as seen in” badges?',
    a: 'Yes. Files for your site, deck, and social, plus the placement links.',
  },
];

/* ---------- Final CTA + footer ---------- */

export const FINAL_CTA = {
  eyebrow: 'Ready when you are',
  headline: ['You already made the news. Now make it', 'everywhere'],
  subhead:
    'Send the article. Approve the draft. We place it. We send the minute you approve. Full distribution takes 1–2 business days. Daily cutoff is 2pm CST.',
  button: 'Send the article',
};

export const FOOTER = {
  legal: '© 2026 Mindscale Partners. Live URLs on named outlets after you approve.',
  cta: 'Send the article',
};

/* ---------- Head ---------- */

export const META = {
  title: 'Mindscale Echo — Your local story, live on AP News, Business Insider, and Yahoo Finance',
  description:
    'Send your local article. Approve the draft. Get live URLs on AP News, Business Insider, and Yahoo Finance.',
  ogTitle: 'Mindscale Echo',
  ogDescription: 'Your local story, live on AP News, Business Insider, and Yahoo Finance.',
};

export const ANNOUNCEMENT_TYPES = [
  'Local news coverage',
  'Business opening',
  'Expansion or new location',
  'Executive hire',
  'Funding announcement',
  'Award or recognition',
  'Partnership',
  'Product or service launch',
  'Community feature',
  'Other milestone',
];
