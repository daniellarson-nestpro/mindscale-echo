import { redirect } from 'next/navigation';
import Nav from '../../components/Nav';
import AppFooter from '../../components/AppFooter';
import ReleaseCard from '../../components/ReleaseCard';
import { getSession } from '../../lib/auth';
import { progressForEmail } from '../../lib/leads';
import { ACCOUNT } from '../../lib/draft';
import { PLANS } from '../../lib/plans';
import { getStripe } from '../../lib/stripe';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';
import { hasBrief, isPaid } from '../../lib/release-status';
import { ArrowUpRight, ArrowRight, Check } from '../../components/Icons';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your releases — Mindscale Echo',
  robots: { index: false, follow: false },
};

async function loadStripeSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

function leadSummary(lead, order) {
  const company = lead?.company_name || order?.company_name || '';
  const announcement = lead?.announcement_type || order?.announcement_type || '';
  return { company, announcement };
}

export default async function AccountPage({ searchParams }) {
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';
  const paidParam = searchParams?.paid === '1';
  const welcome = searchParams?.welcome === '1';
  const planFromQuery = typeof searchParams?.plan === 'string' ? searchParams.plan : '';
  const tokenFromQuery = typeof searchParams?.token === 'string' ? searchParams.token : '';

  const auth = getSession();

  if (!auth?.email && paidParam && sessionId) {
    const nextParams = new URLSearchParams({ paid: '1' });
    if (planFromQuery) nextParams.set('plan', planFromQuery);
    if (tokenFromQuery) nextParams.set('token', safePreviewToken(tokenFromQuery));
    const next = `/account?${nextParams.toString()}`;
    redirect(
      `/api/auth/claim?session_id=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(next)}`
    );
  }

  if (!auth?.email) redirect('/login');

  const progress = await progressForEmail(auth.email);
  const orders = progress.orders || [];
  const lead = progress.lead;
  const ladder = progress.ladder;

  const stripeSession = await loadStripeSession(sessionId);
  const meta = stripeSession?.metadata || {};
  const stripePaid = stripeSession?.payment_status === 'paid';
  const purchased = ladder === 'purchased' || paidParam || stripePaid;
  const v1NeedsBrief = orders.some((order) => isPaid(order) && !hasBrief(order));
  const showV2Purchased = purchased && (paidParam || !v1NeedsBrief);

  const planId = meta.plan || planFromQuery || orders[0]?.plan || '';
  const plan = PLANS[planId];
  const token = safePreviewToken(tokenFromQuery || meta.token || stripeSession?.client_reference_id);
  const email =
    looksLikeEmail(auth.email) ||
    looksLikeEmail(stripeSession?.customer_details?.email) ||
    looksLikeEmail(stripeSession?.customer_email) ||
    looksLikeEmail(meta.email) ||
    '';

  const latestOrder = orders[0] || null;
  const { company, announcement } = leadSummary(lead, latestOrder);
  const previewHref = `/preview/${token}`;
  const checkoutHref = `/checkout?token=${encodeURIComponent(token)}`;

  return (
    <>
      <Nav userEmail={auth.email} />
      <main className="pb-16 pt-32 sm:pt-40">
        <div className="page-shell">
          <header className="max-w-3xl">
            <span className="eyebrow eyebrow-dot">
              {showV2Purchased ? ACCOUNT.cardEyebrow : 'Your workspace'}
            </span>
            <h1 className="mt-7 text-[2.5rem] leading-[0.98] sm:text-[3.4rem]">
              <span className="text-gradient">{ACCOUNT.h1}</span>
              <br />
              <span className="text-gradient-mint">{auth.email}</span>
            </h1>
          </header>

          {welcome && !showV2Purchased && (
            <div
              className="mt-8 max-w-3xl rounded-2xl px-5 py-4 text-[0.9rem] leading-relaxed text-white/65"
              style={{
                background: 'rgba(127,240,192,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22)',
              }}
            >
              Payment confirmed. This workspace is tied to {auth.email}. Keep that address —
              it’s how you return later.
            </div>
          )}

          <div className="mt-10 space-y-8">
            {showV2Purchased && (
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
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-white/55">
                    {ACCOUNT.cardBody}
                  </p>
                  {(company || announcement) && (
                    <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
                      {[company, announcement].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {email ? (
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-white/45">{email}</p>
                  ) : null}
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <a href={previewHref} className="btn btn-primary w-full justify-between sm:w-auto">
                      {ACCOUNT.readIt}
                      <span className="btn-nib">
                        <ArrowRight />
                      </span>
                    </a>
                    <a href="/start" className="btn btn-ghost w-full justify-between sm:w-auto">
                      {ACCOUNT.start}
                      <span className="btn-nib">
                        <ArrowUpRight />
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {ladder === 'draft_ready_unpurchased' && !purchased && (
              <div className="bezel">
                <div className="bezel-core p-7 sm:p-8">
                  <span className="eyebrow">{ACCOUNT.draftEyebrow}</span>
                  <h2 className="mt-6 text-[1.6rem] sm:text-[1.85rem]">{ACCOUNT.draftTitle}</h2>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-white/55">
                    {ACCOUNT.draftBody}
                  </p>
                  {(company || announcement) && (
                    <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
                      {[company, announcement].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <a href={previewHref} className="btn btn-ghost w-full justify-between sm:w-auto">
                      {ACCOUNT.readIt}
                      <span className="btn-nib">
                        <ArrowRight />
                      </span>
                    </a>
                    <a
                      href={checkoutHref}
                      className="btn btn-primary w-full justify-between sm:w-auto"
                    >
                      {ACCOUNT.sendIt}
                      <span className="btn-nib">
                        <ArrowUpRight />
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {ladder === 'in_progress' && !purchased && (
              <div className="bezel">
                <div className="bezel-core p-7 sm:p-8">
                  <h2 className="text-[1.6rem] sm:text-[1.85rem]">{ACCOUNT.inProgressTitle}</h2>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-white/55">
                    {ACCOUNT.inProgressBody}
                  </p>
                  {(company || announcement) && (
                    <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
                      {[company, announcement].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <a href="/brief" className="btn btn-primary mt-8 w-full justify-between sm:w-auto">
                    {ACCOUNT.continue}
                    <span className="btn-nib">
                      <ArrowRight />
                    </span>
                  </a>
                </div>
              </div>
            )}

            {ladder === 'empty' && !purchased && orders.length === 0 && (
              <div className="bezel">
                <div className="bezel-core p-8 sm:p-12">
                  <h2 className="text-[1.8rem]">{ACCOUNT.empty}</h2>
                  <a href="/start" className="btn btn-primary mt-8">
                    {ACCOUNT.start}
                    <span className="btn-nib">
                      <ArrowUpRight />
                    </span>
                  </a>
                </div>
              </div>
            )}

            {orders.map((order) => (
              <ReleaseCard
                key={order.id}
                order={order}
                email={auth.email}
                quiet={showV2Purchased}
              />
            ))}
          </div>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
