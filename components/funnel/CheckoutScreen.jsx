'use client';

import { useEffect, useState } from 'react';
import CheckoutButton from '../CheckoutButton';
import { PLANS } from '../../lib/plans';
import { CHECKOUT, nextSendDay } from '../../lib/draft';
import { Check, Lock, ArrowUpRight } from '../Icons';

/**
 * Mirrors the landing page pricing deliberately — same cards, same language,
 * same CheckoutButton hitting the same POST /api/checkout. No new Stripe UI.
 *
 * The purchase is always framed as *sending it out*. Never "unlock the PDF":
 * at this price the product is distribution and the PDF is an inclusion.
 */
export default function CheckoutScreen({ summary }) {
  const plans = [PLANS.basic, PLANS.premium];
  const [returning, setReturning] = useState(false);
  const day = nextSendDay();

  /** Second arrival without a purchase promotes the booker. */
  useEffect(() => {
    try {
      const seen = Number(window.localStorage.getItem('echo_checkout_views') || '0') + 1;
      window.localStorage.setItem('echo_checkout_views', String(seen));
      if (seen > 1) setReturning(true);
    } catch {
      /* private mode — no promotion, no harm */
    }
  }, []);

  return (
    <>
      <span className="eyebrow eyebrow-dot">{CHECKOUT.eyebrow}</span>
      <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">{CHECKOUT.h1}</h1>

      {summary && (
        <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/38">
          {summary}
        </p>
      )}

      <div className="mt-10 grid items-start gap-5 lg:grid-cols-2">
        {plans.map((plan) => {
          const featured = plan.featured;
          return (
            <div key={plan.id} className={featured ? 'lg:-mt-2' : ''}>
              <div
                className="bezel plan-card h-full"
                style={
                  featured
                    ? {
                        background:
                          'linear-gradient(150deg, rgba(127,240,192,0.24), rgba(109,92,246,0.18) 60%, rgba(255,255,255,0.03))',
                        boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.3), var(--ambient)',
                      }
                    : undefined
                }
              >
                <div className="bezel-core flex h-full flex-col p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[1.6rem] sm:text-[1.85rem]">
                      {plan.name} — {plan.priceLabel}
                    </h2>
                    {featured && (
                      <span className="eyebrow shrink-0">{CHECKOUT.premiumTag}</span>
                    )}
                  </div>

                  <p className="mt-3 text-[0.92rem] leading-relaxed text-white/55">
                    {featured ? CHECKOUT.premiumLine : CHECKOUT.basicLine}
                  </p>

                  {plan.delta && (
                    <p
                      className="mt-5 rounded-2xl px-4 py-3 text-[0.86rem] leading-snug text-white/78"
                      style={{
                        background: 'rgba(127,240,192,0.08)',
                        boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22)',
                      }}
                    >
                      {plan.delta}
                    </p>
                  )}

                  <div className="mt-6 rule" />

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span
                          className="mt-[0.15rem] flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: featured
                              ? 'rgba(127,240,192,0.14)'
                              : 'rgba(255,255,255,0.06)',
                            boxShadow: `inset 0 0 0 1px ${
                              featured ? 'rgba(127,240,192,0.3)' : 'rgba(255,255,255,0.1)'
                            }`,
                            color: featured ? '#7ff0c0' : 'rgba(255,255,255,0.7)',
                          }}
                        >
                          <Check width={10} height={10} />
                        </span>
                        <span className="text-[0.88rem] leading-relaxed text-white/62">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <CheckoutButton
                    plan={plan.id}
                    label={`Send it out — ${plan.priceLabel}`}
                    variant={featured ? 'primary' : 'ghost'}
                    className="mt-8"
                  />
                  <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-eyebrow text-white/30">
                    Goes out {day} morning
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-white/38">
        <span className="flex items-center gap-2 text-[0.8rem]">
          <Lock width={12} height={12} /> {CHECKOUT.underButtons}
        </span>
      </div>

      <div className="mt-10 rule" />

      {/* The booker: quiet by default, promoted on a second visit. Never a popup. */}
      {returning ? (
        <div className="mt-8">
          <div className="bezel">
            <div className="bezel-core flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <p className="max-w-xl text-[0.95rem] leading-relaxed text-white/60">
                {CHECKOUT.bookerPromoted}
              </p>
              <a href="/call" className="btn btn-ghost shrink-0">
                {CHECKOUT.bookerCta}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-[0.88rem] text-white/40">
          {CHECKOUT.bookerLine}{' '}
          <a
            href="/call"
            className="text-echo-mint underline decoration-echo-mint/30 underline-offset-4 transition-colors duration-300 hover:decoration-echo-mint"
          >
            {CHECKOUT.bookerCta}
          </a>
        </p>
      )}
    </>
  );
}
