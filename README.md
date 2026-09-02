# Mindscale Echo

**AI-powered media distribution for the human and AI layers.**

An ultra-premium landing page and Stripe checkout workflow for Mindscale Echo — the product
that turns existing local coverage into a professionally written press release and distributes
it across traditional media and, on Premium, AI discovery channels.

Built with Next.js 14 (App Router), React 18, Tailwind CSS 3, the Stripe Node SDK,
Vercel Postgres (Neon), signed magic-link sessions, and Resend for login email.

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

## Stripe setup (the only required configuration for checkout)

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

### 3. Test checkout

Use Stripe test mode and card `4242 4242 4242 4242`, any future expiry, any CVC.

Checkout creates a Stripe Customer (`customer_creation: 'always'`) and collects the buyer’s
email on the hosted Checkout page.

---

## Customer workspace (V1)

After a paid Checkout, the buyer gets a real order record and a passwordless workspace at
`/account`. The homepage **Dashboard** section stays a marketing preview — it is not the
customer account UI and does not show live outlet counts.

| Step | What happens                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 1    | Visitor clicks **Buy Basic** / **Buy Premium** on `/#pricing`                                           |
| 2    | `POST /api/checkout` creates a Checkout Session (and a Stripe Customer) and returns its URL            |
| 3    | Browser redirects to Stripe Checkout                                                                   |
| 4    | Stripe fires `checkout.session.completed` → `POST /api/stripe-webhook` upserts the order               |
| 5    | Success URL `/success?session_id=...&plan=...` verifies the session (fast path), upserts, signs in     |
| 6    | Buyer lands on `/account?welcome=1` with their paid Basic/Premium release                              |
| 7    | If the brief is not in yet, they submit the same onboarding fields from the workspace                  |
| 8    | Later visits: header **Log in** → magic link to the same email → `/account`                            |

Status on `/account` is honest: **Paid** and **Brief received** come from stored data.
**Draft in progress**, **Awaiting approval**, and **Distributed** are placeholders until
those features exist. No placement counts are invented.

Auth never lists another customer’s orders — queries are scoped to the signed-in email.

---

## Environment variables

| Variable                 | Required | Purpose                                                                 |
| ------------------------ | -------- | ----------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`      | Yes      | Server-side Stripe API key. Never exposed to the client.                 |
| `STRIPE_PRICE_BASIC`     | Yes      | Price ID for the $499 Basic package.                                     |
| `STRIPE_PRICE_PREMIUM`   | Yes      | Price ID for the $699 Premium package.                                   |
| `NEXT_PUBLIC_SITE_URL`   | Yes (prod) | Absolute origin for Stripe return URLs and magic-link emails. Never taken from `Host` / `X-Forwarded-Host`. On Vercel, `VERCEL_URL` is used if this is unset. |
| `STRIPE_WEBHOOK_SECRET`  | Yes (prod) | Signing secret for `POST /api/stripe-webhook`.                         |
| `POSTGRES_URL`           | Yes (workspace) | Neon / Vercel Postgres connection string. `DATABASE_URL` also works. |
| `AUTH_SECRET`            | Yes (workspace) | HMAC secret for the httpOnly session cookie.                         |
| `RESEND_API_KEY`         | Yes (prod login) | Resend API key for magic-link email.                                |
| `EMAIL_FROM`             | Yes (prod login) | Verified from-address, e.g. `Mindscale Echo <hello@domain.com>`.    |
| `ONBOARDING_WEBHOOK_URL` | Optional | Extra JSON POST of every saved brief (Zapier / Make / etc.).           |

No secret is ever hardcoded, and `.env` / `.env.local` are gitignored.

### Create the dashboard resources (Daniel)

These cannot be invented in git. After they exist, paste the names above into Vercel →
Project **mindscale-echo** → Settings → Environment Variables (Production + Preview),
then redeploy.

**1. Postgres (Neon / Vercel Storage)**

1. Vercel dashboard → **mindscale-echo** → **Storage** → **Create Database** → **Neon**
   (or the current Vercel Postgres integration).
2. Connect it to the project. Vercel injects `POSTGRES_URL`.
3. Tables are created automatically on the first workspace request (`lib/db.js`).
   You can also run `sql/schema.sql` in the Neon SQL editor.

**2. Auth secret**

```bash
openssl rand -base64 32
```

Set the result as `AUTH_SECRET`. Use a different value in Preview vs Production if you like.

**3. Resend (magic-link email)**

1. Create a [Resend](https://resend.com) account and API key.
2. Verify the sending domain (or, for a first test only, use Resend’s onboarding sender
   and send only to the account’s own email).
3. Set `RESEND_API_KEY` and `EMAIL_FROM`.

**Local / PR mail trap:** in non-production, `POST /api/auth/login` still returns
`devLoginUrl` in the JSON (and logs it). The login screen shows that link so you can
finish the flow without Resend. Production never returns the URL.

**4. Stripe webhook**

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
   `https://<your-domain>/api/stripe-webhook`
2. Listen for `checkout.session.completed` (and optionally
   `checkout.session.async_payment_succeeded`).
3. Set `STRIPE_WEBHOOK_SECRET` from the endpoint’s signing secret.

Locally: `stripe listen --forward-to localhost:3000/api/stripe-webhook` and put the CLI
`whsec_...` in `.env.local`.

---

## Where the onboarding brief goes

`app/api/onboarding/route.js` validates the submission, then:

1. Stores the brief on the paid order in Postgres (keyed by Stripe session / order id,
   and only if that order belongs to the logged-in or checkout-verified email).
2. POSTs it to `ONBOARDING_WEBHOOK_URL` if that variable is set (optional extra).
3. Logs a short confirmation server-side.

The uploaded logo is recorded as filename / type / size on the order. Binary storage is
still a hook (`await logo.arrayBuffer()` → S3, R2, Supabase Storage, or UploadThing).

Collected fields: company name, website, contact name, contact email, article URL,
announcement type, preferred quote + attribution, free-form notes, and an optional logo
(≤ 5 MB, PNG/JPEG/SVG/WebP).

---

## Deployment

Works on any Node host. On **Vercel**: import the repo, add the environment variables under
Project → Settings → Environment Variables, deploy. Set `NEXT_PUBLIC_SITE_URL` to the
production URL so Stripe and magic links return customers to the right origin.

Production site: `https://mindscale-echo.vercel.app` (Vercel project `mindscale-echo`).

---

## Project structure

```
app/
  layout.jsx                 Fonts, metadata, grain overlay, scroll-reveal mount
  page.jsx                   Landing page composition (marketing mock dashboard stays here)
  globals.css                Design system (tokens, bezels, buttons, reveals)
  success/page.jsx           Post-checkout fast path → claim session → /account
  cancel/page.jsx            Cancelled checkout → back to pricing
  login/page.jsx             Magic-link request
  account/page.jsx           Logged-in workspace (real orders only)
  api/checkout/route.js      Creates the Stripe Checkout Session + Customer
  api/onboarding/route.js    Saves the brief onto the order
  api/stripe-webhook/route.js  checkout.session.completed → persist order
  api/auth/login/route.js    Issue magic link
  api/auth/callback/route.js Consume magic link, set cookie
  api/auth/claim/route.js    Sign in from a verified Checkout session_id
  api/auth/logout/route.js   Clear session cookie
  api/auth/me/route.js       { email } for the header
components/
  Nav.jsx                    Floating glass pill nav + Log in / Workspace
  CheckoutButton.jsx         Client-side checkout trigger with error surface
  OnboardingForm.jsx         Brief form + confirmation screen
  LoginForm.jsx              Magic-link request form
  ReleaseCard.jsx            One customer release in /account
  ScrollReveal.jsx           IntersectionObserver reveals (progressive enhancement)
  Icons.jsx                  Hairline icon set
  sections/                  Hero, Badges, Distribution, HowItWorks, Pricing,
                             DashboardPreview (marketing mock), FollowUp, Trust, Faq, Footer
lib/
  content.js                 All marketing copy and data
  plans.js                   Package catalogue + price ID resolution
  stripe.js                  Lazy Stripe client + origin resolution
  db.js                      Neon client + schema ensure
  orders.js                  Idempotent order upsert + brief attach
  auth.js                    Signed cookie session + magic-link tokens
  email.js                   Resend magic-link sender
  release-status.js          Paid / Brief received vs placeholder steps
sql/
  schema.sql                 orders + magic_links
```

## Editing copy

Nearly all marketing text lives in `lib/content.js` (headlines, diagram, badges, steps,
dashboard preview, FAQ) and `lib/plans.js` (package names, prices, feature lists).
Layout changes are rarely needed for copy edits.

---

## Manual test plan

This repo has no test runner. After env vars are set:

1. `npm run dev`. Confirm the marketing homepage still renders and **Log in** is in the header.
2. Buy Basic (or Premium) with Stripe test card `4242…`. Use a real inbox you control.
3. Confirm Stripe shows a Customer on the Checkout Session.
4. Confirm an `orders` row exists (Neon SQL: `SELECT email, plan, payment_status, amount_cents FROM orders;`)
   even if you skip `/success` (webhook path) — or because you did land on `/success` (fast path).
5. You should be signed in on `/account?welcome=1` seeing **your** package, paid status, amount,
   and date — not the homepage mock dashboard or invented outlet counts.
6. Submit the brief from `/account`. Reload: status is **Brief received** and the saved fields show.
7. Log out. Request a magic link with the same email. Open the Resend email, or in development
   click **Open the login link** (`devLoginUrl`). You land in the same workspace.
8. Request a link with a different email: you must not see the first customer’s order.
9. Confirm `/#dashboard` on the marketing site is unchanged as a preview.

---

## Compliance note

Outlet and AI-platform names describe the distribution network and eligible placement
surfaces. The UI deliberately avoids guarantee language: it uses "distribution network
includes", "eligible placements", and "featured placement reporting", and the FAQ states
plainly that no company can fully control AI-generated answers. Keep that framing if you
edit the copy.
