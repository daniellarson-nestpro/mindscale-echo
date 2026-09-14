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
    tagline: 'Named national URLs.',
    cta: 'Send the article — $499 after you approve',
    checkoutCta: 'Send it out — $499',
    featured: false,
    features: [
      'Press release written from your article',
      'You approve before anything is sent',
      'Live, indexable URLs on AP News, Business Insider, and Yahoo Finance',
      '300+ outlet distribution',
      '“As seen in” badge kit',
      'Placement links in your workspace',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 699,
    priceLabel: '$699',
    cadence: 'per release',
    tagline: 'Named URLs plus AIWire.',
    cta: 'Send the article — $699 after you approve',
    checkoutCta: 'Send it out — $699',
    featured: true,
    badge: 'Recommended',
    delta: '+$200 → more outlets, AIWire, and an AI visibility report.',
    features: [
      'Everything in Basic',
      '500+ outlet distribution',
      'StreetInsider and Benzinga',
      'AIWire for ChatGPT, Perplexity, Gemini, Copilot, and Grok',
      'AI visibility report',
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
