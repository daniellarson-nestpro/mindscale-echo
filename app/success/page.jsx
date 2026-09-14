import { redirect } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/sections/Footer';
import { getStripe } from '../../lib/stripe';
import { PLANS } from '../../lib/plans';
import { SUCCESS } from '../../lib/draft';
import { SUPPORT_EMAIL } from '../../lib/funnel';
import { Check, ArrowUpRight } from '../../components/Icons';
import { getAuthSecret } from '../../lib/auth';
import { notifyPaidOrder, upsertOrderFromCheckoutSession } from '../../lib/orders';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'It’s out — Mindscale Echo',
  robots: { index: false, follow: false },
};

async function loadSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

/**
 * Stripe's success_url when checkout was not started from the V2 funnel.
 * A paid session is persisted and claimed straight into the workspace; this
 * page only renders when the session cannot be claimed automatically.
 */
export default async function SuccessPage({ searchParams }) {
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';
  const planParam = typeof searchParams?.plan === 'string' ? searchParams.plan : '';

  const session = await loadSession(sessionId);
  const planId = session?.metadata?.plan || planParam || '';
  const plan = PLANS[planId];
  const email = session?.customer_details?.email || session?.customer_email || '';
  const paid = session ? session.payment_status === 'paid' : null;

  if (session && paid && sessionId && getAuthSecret()) {
    let order = null;
    try {
      order = await upsertOrderFromCheckoutSession(session);
    } catch (err) {
      console.error('[success] persist failed:', err?.message);
    }
    await notifyPaidOrder(order);
    const next = encodeURIComponent('/account?paid=1');
    redirect(`/api/auth/claim?session_id=${encodeURIComponent(sessionId)}&next=${next}`);
  }

  const workspaceHref = email ? `/login?email=${encodeURIComponent(email)}` : '/login';

  return (
    <>
      <Nav />
      <main className="pb-10 pt-32 sm:pt-40">
        <div className="page-shell">
          <div className="mx-auto max-w-3xl">
            <header className="text-center">
              <span className="eyebrow eyebrow-dot">
                {paid === false ? 'Payment processing' : 'Sent'}
              </span>
              <h1 className="mt-7 text-[2.6rem] leading-[0.98] sm:text-[3.6rem]">
                <span className="text-gradient-mint">
                  {paid === false ? 'Payment is still processing.' : SUCCESS.h1}
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[1rem] leading-relaxed text-white/55">
                {paid === false
                  ? 'Your bank is still confirming the payment. We send the release the moment it clears, and your workspace will show it.'
                  : SUCCESS.body}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
                {plan && (
                  <span className="logo-pill">
                    {plan.name} · {plan.priceLabel}
                  </span>
                )}
                {paid && (
                  <span className="eyebrow">
                    <Check width={11} height={11} /> Paid
                  </span>
                )}
                {sessionId && (
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/25">
                    Ref {sessionId.slice(-10)}
                  </span>
                )}
              </div>
            </header>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a href={workspaceHref} className="btn btn-primary">
                {SUCCESS.cta}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
            </div>

            <p className="mt-8 text-center text-[0.78rem] leading-relaxed text-white/30">
              Questions about this release? Reply to your Stripe receipt or email {SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
