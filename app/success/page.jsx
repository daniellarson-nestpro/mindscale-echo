import Nav from '../../components/Nav';
import Footer from '../../components/sections/Footer';
import OnboardingForm from '../../components/OnboardingForm';
import { getStripe } from '../../lib/stripe';
import { PLANS } from '../../lib/plans';
import { Check } from '../../components/Icons';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment confirmed — submit your release brief | Mindscale Echo',
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

export default async function SuccessPage({ searchParams }) {
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';
  const planParam = typeof searchParams?.plan === 'string' ? searchParams.plan : '';

  const session = await loadSession(sessionId);
  const planId = session?.metadata?.plan || planParam || '';
  const plan = PLANS[planId];
  const email = session?.customer_details?.email || '';
  const paid = session ? session.payment_status === 'paid' : null;

  return (
    <>
      <Nav />
      <main className="pb-10 pt-32 sm:pt-40">
        <div className="page-shell">
          <div className="mx-auto max-w-3xl">
            <header className="text-center">
              <span className="eyebrow eyebrow-dot">
                {paid === false ? 'Payment processing' : 'Step 2 of 2'}
              </span>
              <h1 className="mt-7 text-[2.6rem] leading-[0.98] sm:text-[3.6rem]">
                <span className="text-gradient">Payment confirmed.</span>
                <br />
                <span className="text-gradient-mint">Tell us the story.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[1rem] leading-relaxed text-white/55">
                Send us your local article and company details. We’ll draft the release and send
                it back for your approval before anything is distributed.
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

            <div className="mt-12">
              <OnboardingForm sessionId={sessionId} plan={planId} prefillEmail={email} />
            </div>

            <p className="mt-8 text-center text-[0.78rem] leading-relaxed text-white/30">
              Need to change something after submitting? Reply to your Stripe receipt or email
              hello@mindscalepartners.com and we’ll update the brief before drafting.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
