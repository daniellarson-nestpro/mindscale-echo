import FunnelShell from '../../components/funnel/FunnelShell';
import { ACCOUNT, DEMO_DRAFT } from '../../lib/draft';
import { PLANS } from '../../lib/plans';
import { getStripe } from '../../lib/stripe';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';
import { ArrowUpRight, ArrowRight, Check } from '../../components/Icons';

export const metadata = {
  title: 'Your releases | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

async function loadSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

export default async function AccountPage({ searchParams }) {
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';
  const session = await loadSession(sessionId);
  const meta = session?.metadata || {};

  const paid = searchParams?.paid === '1' || session?.payment_status === 'paid';
  const planId = meta.plan || (typeof searchParams?.plan === 'string' ? searchParams.plan : '');
  const plan = PLANS[planId];
  const token = safePreviewToken(searchParams?.token || meta.token || session?.client_reference_id);
  const email =
    looksLikeEmail(session?.customer_details?.email) ||
    looksLikeEmail(session?.customer_email) ||
    looksLikeEmail(meta.email) ||
    looksLikeEmail(searchParams?.email) ||
    '';

  // STUB — brief/composer are not persisted on this branch (DEMO_DRAFT,
  // PATCH /api/brief is a console.log). Show the demo company/summary so the
  // return page isn't an empty V1 onboarding form. Do not render OnboardingForm.
  const company = DEMO_DRAFT.companyName;
  const summary = DEMO_DRAFT.headline;
  const previewHref = `/preview/${token}`;

  return (
    <FunnelShell>
      <span className="eyebrow eyebrow-dot">{paid ? ACCOUNT.cardEyebrow : 'Workspace'}</span>
      <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">{ACCOUNT.h1}</h1>

      {paid ? (
        <div className="mt-10">
          <div className="bezel">
            <div className="bezel-core p-7 sm:p-8">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="eyebrow">
                  <Check width={11} height={11} /> Paid
                </span>
                {plan && (
                  <span className="logo-pill">
                    {plan.name} · {plan.priceLabel}
                  </span>
                )}
                {sessionId && (
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/25">
                    Ref {sessionId.slice(-10)}
                  </span>
                )}
              </div>
              <h2 className="mt-6 text-[1.6rem] sm:text-[1.85rem]">{ACCOUNT.cardTitle}</h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-white/55">{ACCOUNT.cardBody}</p>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
                {company} · {summary}
              </p>
              {email ? (
                <p className="mt-2 text-[0.88rem] leading-relaxed text-white/45">{email}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/55">{ACCOUNT.empty}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {paid && (
          <a href={previewHref} className="btn btn-primary w-full justify-between sm:w-auto">
            {ACCOUNT.readIt}
            <span className="btn-nib">
              <ArrowRight />
            </span>
          </a>
        )}
        <a
          href="/start"
          className={`btn w-full justify-between sm:w-auto ${paid ? 'btn-ghost' : 'btn-primary'}`}
        >
          {ACCOUNT.start}
          <span className="btn-nib">
            <ArrowUpRight />
          </span>
        </a>
      </div>
    </FunnelShell>
  );
}
