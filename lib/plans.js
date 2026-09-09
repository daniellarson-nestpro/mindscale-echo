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
    tagline: 'Traditional media visibility.',
    cta: 'Buy Basic — $499',
    featured: false,
    features: [
      'AI-assisted press release writing',
      '300+ media outlet distribution network',
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
    tagline: 'AI visibility, expanded authority, broader distribution.',
    cta: 'Buy Premium — $699',
    featured: true,
    delta: '+$200 → 200 more outlets, the AI discovery layer, and podcast distribution.',
    features: [
      'Everything in Basic',
      '500+ media outlet distribution network',
      'Higher-authority placement network',
      'AI discovery layer support',
      'AI visibility report',
      'Podcast distribution (Spotify, Apple, YouTube +6)',
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
