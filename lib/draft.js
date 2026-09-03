/**
 * Draft shape + copy for the preview and checkout screens.
 *
 * DEMO_DRAFT stands in until the composer is wired. The real object comes from
 * `draft_body` (markdown/plain text) plus the brief fields — see the backend
 * contract. Keep the shape identical so swapping the source is a one-liner.
 */

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
  /** Co-owners, partners, a GM — rendered after the primary quote. */
  additionalQuotes: [
    {
      quote:
        'My brother runs the front. I run the kitchen. Third Street is the first time we get an oven big enough to keep up with a Friday.',
      attribution: 'Maria Marino, Co-owner',
    },
  ],
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
  disclosure:
    'The words are free to read, for as long as you like. The letterhead copy and the PDF are part of what you’re paying for.',
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
  start: 'Start a release',
  empty: 'Nothing sent yet. Start a release when you’re ready.',
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
