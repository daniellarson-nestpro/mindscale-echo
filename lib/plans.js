/**
 * Package catalogue.
 *
 * Stripe price IDs resolve from environment variables and fall back to the
 * documented placeholders so the app boots before Stripe is wired up.
 * See .env.example / README.md.
 */

export const PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 499,
    priceLabel: '$499',
    cadence: 'per release',
    tagline: 'Best for traditional media visibility.',
    cta: 'Buy Basic',
    featured: false,
    features: [
      'AI-assisted press release writing',
      'Standard press release distribution',
      '300+ media outlet distribution',
      'Search-indexed placements',
      '“As seen in” badge assets',
      'Placement dashboard',
      'Basic reporting',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 699,
    priceLabel: '$699',
    cadence: 'per release',
    tagline: 'Best for AI visibility, expanded authority, and broader distribution.',
    cta: 'Buy Premium',
    featured: true,
    features: [
      'Everything in Basic',
      '500+ media outlet distribution',
      'Higher-authority placement network',
      'AI discovery layer support',
      'AI visibility report',
      'Podcast / audio distribution',
      'Distribution to podcast platforms such as Spotify, YouTube, Amazon Music, Apple Podcasts, iHeart, Player.fm, Podchaser, Podbean, and Boomplay',
      'Enhanced dashboard',
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS);

/** Server-only: resolve the Stripe Price ID for a package. */
export function priceIdFor(planId) {
  const map = {
    basic: process.env.STRIPE_PRICE_BASIC || 'price_BASIC_REPLACE_ME',
    premium: process.env.STRIPE_PRICE_PREMIUM || 'price_PREMIUM_REPLACE_ME',
  };
  return map[planId];
}

export function isPlaceholderPriceId(priceId) {
  return typeof priceId === 'string' && priceId.includes('REPLACE_ME');
}
