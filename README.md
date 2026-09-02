# Mindscale Echo

**AI-powered media distribution for the human and AI layers.**

An ultra-premium landing page and Stripe checkout workflow for Mindscale Echo — the product
that turns existing local coverage into a professionally written press release and distributes
it across traditional media and, on Premium, AI discovery channels.

Built with Next.js 14 (App Router), React 18, Tailwind CSS 3, and the Stripe Node SDK.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

---

## Stripe setup (the only required configuration)

### 1. Create the two products

In the [Stripe Dashboard](https://dashboard.stripe.com/products) → **Products → Add product**,
create two products, each with a **one-time** price:

| Package | Price | Suggested product name           |
| ------- | ----- | -------------------------------- |
| Basic   | $499  | Mindscale Echo — Basic Release   |
| Premium | $699  | Mindscale Echo — Premium Release |

Copy each price's ID — it looks like `price_1QxxxxxxxxxxxxxxxxxxxxxX`.

### 2. Fill in `.env.local`

```bash
STRIPE_SECRET_KEY=sk_test_...                 # server-side only, never committed
STRIPE_PRICE_BASIC=price_...                  # replaces price_BASIC_REPLACE_ME
STRIPE_PRICE_PREMIUM=price_...                # replaces price_PREMIUM_REPLACE_ME
NEXT_PUBLIC_SITE_URL=http://localhost:3000    # your real origin in production
```

**Where the placeholders live:** `lib/plans.js` → `priceIdFor()`. It reads the env vars and
falls back to `price_BASIC_REPLACE_ME` / `price_PREMIUM_REPLACE_ME`. If a placeholder is still
in play, the checkout API returns a clear 503 telling you which variable to set — the buttons
never silently fail.

### 3. Test the flow

Use Stripe test mode and card `4242 4242 4242 4242`, any future expiry, any CVC.

| Step | What happens                                                                    |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Visitor clicks **Buy Basic** / **Buy Premium** on `/#pricing`                     |
| 2    | `POST /api/checkout` creates a Checkout Session server-side and returns its URL  |
| 3    | Browser redirects to Stripe Checkout                                             |
| 4    | Success → `/success?session_id=...&plan=...` renders the onboarding brief form   |
| 5    | Cancel → `/cancel` explains no charge was made and links back to pricing         |
| 6    | Brief submitted → `POST /api/onboarding` → confirmation screen                   |

The success page retrieves the Checkout Session server-side to confirm `payment_status`,
show the purchased package, and prefill the customer's email.

---

## Environment variables

| Variable                 | Required | Purpose                                                              |
| ------------------------ | -------- | -------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`      | Yes      | Server-side Stripe API key. Never exposed to the client.              |
| `STRIPE_PRICE_BASIC`     | Yes      | Price ID for the $499 Basic package.                                  |
| `STRIPE_PRICE_PREMIUM`   | Yes      | Price ID for the $699 Premium package.                                |
| `NEXT_PUBLIC_SITE_URL`   | Recommended | Absolute origin for Stripe return URLs. Falls back to request headers. |
| `ONBOARDING_WEBHOOK_URL` | Optional | Every onboarding brief is POSTed here as JSON.                        |
| `STRIPE_WEBHOOK_SECRET`  | Optional | Only if you add the webhook handler below.                            |

No secret is ever hardcoded, and `.env` / `.env.local` are gitignored.

---

## Where the onboarding brief goes

`app/api/onboarding/route.js` validates the submission and currently:

1. POSTs it to `ONBOARDING_WEBHOOK_URL` if that variable is set, and
2. logs it server-side.

Two clearly marked `// HOOK` comments show where to plug in real persistence:

- **HOOK (storage)** — the uploaded logo arrives as a `File`; call `await logo.arrayBuffer()`
  and push it to S3, R2, Supabase Storage, or UploadThing, then store the URL.
- **HOOK (delivery)** — swap or supplement the webhook with Resend/Postmark email, a CRM
  record, a Google Sheet row, or a database insert.

Collected fields: company name, website, contact name, contact email, article URL,
announcement type, preferred quote + attribution, free-form notes, and an optional logo
(≤ 5 MB, PNG/JPEG/SVG/WebP).

---

## Optional: Stripe webhook (recommended for production)

The success page confirms payment by retrieving the session, which is enough for the customer
experience. For durable fulfilment records, add a webhook so payment confirmation does not
depend on the customer landing on the success page:

1. Create `app/api/stripe-webhook/route.js`, verify with
   `stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)`.
2. Listen for `checkout.session.completed` and record the order.
3. Register the endpoint at Stripe → Developers → Webhooks.

Locally: `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

---

## Deployment

Works on any Node host. On **Vercel**: import the repo, add the environment variables under
Project → Settings → Environment Variables, deploy. Set `NEXT_PUBLIC_SITE_URL` to the
production URL so Stripe returns customers to the right origin.

---

## Project structure

```
app/
  layout.jsx              Fonts, metadata, grain overlay, scroll-reveal mount
  page.jsx                Landing page composition
  globals.css             Design system (tokens, bezels, buttons, reveals)
  success/page.jsx        Post-checkout onboarding (server-verified session)
  cancel/page.jsx         Cancelled checkout → back to pricing
  api/checkout/route.js   Creates the Stripe Checkout Session
  api/onboarding/route.js Receives the release brief
components/
  Nav.jsx                 Floating glass pill nav + morphing hamburger overlay
  CheckoutButton.jsx      Client-side checkout trigger with error surface
  OnboardingForm.jsx      Brief form + confirmation screen
  ScrollReveal.jsx        IntersectionObserver reveals (progressive enhancement)
  Icons.jsx               Hairline icon set
  sections/               Hero, Badges, Distribution, HowItWorks, Pricing,
                          DashboardPreview, FollowUp, Trust, Faq, Footer
lib/
  content.js              All marketing copy and data
  plans.js                Package catalogue + price ID resolution
  stripe.js               Lazy Stripe client + origin resolution
```

## Editing copy

Nearly all text lives in `lib/content.js` (headlines, diagram, badges, steps, dashboard, FAQ)
and `lib/plans.js` (package names, prices, feature lists). Layout changes are rarely needed
for copy edits.

---

## Compliance note

Outlet and AI-platform names describe the distribution network and eligible placement
surfaces. The UI deliberately avoids guarantee language: it uses "distribution network
includes", "eligible placements", and "featured placement reporting", and the FAQ states
plainly that no company can fully control AI-generated answers. Keep that framing if you
edit the copy.
