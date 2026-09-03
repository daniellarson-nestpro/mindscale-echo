import FunnelShell from '../../components/funnel/FunnelShell';
import { ACCOUNT } from '../../lib/draft';
import { PLANS } from '../../lib/plans';
import { ArrowUpRight, ArrowRight, Check } from '../../components/Icons';

export const metadata = {
  title: 'Your releases | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AccountPage({ searchParams }) {
  const paid = searchParams?.paid === '1';
  const sessionId = typeof searchParams?.session_id === 'string' ? searchParams.session_id : '';
  const planParam = typeof searchParams?.plan === 'string' ? searchParams.plan : '';
  const plan = PLANS[planParam];
  // HOOK: latest draft token for the signed-in owner. Demo stands in until then.
  const previewHref = '/preview/demo';

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
