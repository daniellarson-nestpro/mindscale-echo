import { PLANS } from '../lib/plans';
import {
  RELEASE_STEPS,
  currentStepId,
  formatAmount,
  formatDate,
  hasBrief,
  isPaid,
  stepState,
} from '../lib/release-status';
import { Check } from './Icons';
import OnboardingForm from './OnboardingForm';

export default function ReleaseCard({ order, email }) {
  const plan = PLANS[order.plan];
  const paid = isPaid(order);
  const brief = hasBrief(order);
  const current = currentStepId(order);

  return (
    <article className="bezel" data-order-id={order.stripe_session_id || order.id}>
      <div className="bezel-core overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-7">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
              Your release
            </p>
            <h2 className="mt-1 font-display text-[1.45rem] text-white">
              {plan?.name || order.plan} package
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paid && (
              <span className="eyebrow">
                <Check width={11} height={11} /> Paid
              </span>
            )}
            {!paid && (
              <span className="logo-pill">{order.payment_status || 'Unpaid'}</span>
            )}
            <span className="logo-pill">
              {formatAmount(order.amount_cents, order.currency)}
            </span>
          </div>
        </div>

        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3">
          <Meta label="Package" value={plan?.name || order.plan} />
          <Meta
            label="Paid"
            value={paid ? formatDate(order.paid_at || order.created_at) : 'Not yet'}
          />
          <Meta label="Brief" value={brief ? 'Received' : 'Not submitted'} />
        </div>

        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
              Status
            </p>
            <ol className="mt-4 space-y-3.5">
              {RELEASE_STEPS.map((step) => {
                const state = stepState(order, step.id);
                const done = state === 'complete' || state === 'current';
                return (
                  <li key={step.id} className="flex items-center gap-3">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: done ? 'rgba(127,240,192,0.14)' : 'rgba(255,255,255,0.045)',
                        boxShadow: `inset 0 0 0 1px ${
                          done ? 'rgba(127,240,192,0.32)' : 'rgba(255,255,255,0.09)'
                        }`,
                        color: done ? '#7ff0c0' : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {done ? <Check width={11} height={11} /> : null}
                    </span>
                    <span
                      className={`text-[0.86rem] ${
                        state === 'current'
                          ? 'text-white'
                          : done
                            ? 'text-white/72'
                            : 'text-white/35'
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 text-[0.76rem] leading-relaxed text-white/32">
              Later steps stay placeholders until your draft is ready. This workspace does not
              invent placement counts.
            </p>
          </div>

          <div className="lg:col-span-7">
            {brief ? (
              <BriefSummary order={order} />
            ) : (
              <>
                <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                  Submit your release brief
                </p>
                <p className="mt-2 mb-5 text-[0.88rem] leading-relaxed text-white/50">
                  Paid — we still need the story details before drafting. Nothing is distributed
                  until you approve the release.
                </p>
                <OnboardingForm
                  sessionId={order.stripe_session_id}
                  orderId={order.id}
                  plan={order.plan}
                  prefillEmail={email}
                  successHref="/account"
                  framed={false}
                />
              </>
            )}

            <div
              className="mt-6 rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.024)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                Draft / approval
              </p>
              <p className="mt-2 text-[0.86rem] leading-relaxed text-white/50">
                {current === 'brief_received'
                  ? 'Your brief is in. The press release draft will appear here for approval when it is ready.'
                  : 'After the brief is in, your draft will appear here for approval. Nothing is distributed until you approve it.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value }) {
  return (
    <div className="bg-ink-900 px-5 py-5 sm:px-7">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/32">{label}</p>
      <p className="mt-2 font-display text-[1.35rem] leading-none text-white">{value}</p>
    </div>
  );
}

function BriefSummary({ order }) {
  const rows = [
    ['Company', order.company_name],
    ['Website', order.website],
    ['Contact', order.contact_name],
    ['Contact email', order.contact_email],
    ['Announcement', order.announcement_type],
    ['Article', order.article_url],
    ['Quote', order.quote],
    ['Attribution', order.quote_attribution],
    ['Notes', order.notes],
    ['Logo', order.logo_name],
  ].filter(([, value]) => Boolean(value));

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
        Brief received {order.brief_submitted_at ? formatDate(order.brief_submitted_at) : ''}
      </p>
      <dl className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
              {label}
            </dt>
            <dd className="text-[0.88rem] leading-relaxed text-white/70 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
