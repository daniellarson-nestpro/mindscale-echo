'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ArticleDrop from './ArticleDrop';
import { STEP_ARTICLE, STEP_EMAIL, STEP_MILESTONE, MILESTONES } from '../../lib/funnel';
import { ArrowUpRight, ArrowRight } from '../Icons';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Steps 0 and 1 are two states of one component, deliberately: if the article
 * chip resolves fast enough they can be collapsed into a single view behind a
 * flag and tested. Do not split them into separate routes.
 */
export default function StartFlow() {
  const router = useRouter();
  const [stage, setStage] = useState('article'); // article | milestone | email
  const [sources, setSources] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [articleError, setArticleError] = useState(null);

  const [milestone, setMilestone] = useState('');
  const [milestoneOther, setMilestoneOther] = useState('');

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [sending, setSending] = useState(false);
  const [prefill, setPrefill] = useState({});

  /**
   * Outbound-email prefill. Params are read once, then stripped from the URL —
   * their email address should not sit in the address bar of a shared iPad
   * behind the register. No account is created from params alone.
   *
   * Outbound params are also written to POST /api/prefill (signed 10-minute
   * cookie). Verify merges that cookie onto the lead.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return;

    const picked = {};
    ['email', 'companyName', 'articleUrl', 'quote', 'contactName', 'phone'].forEach((k) => {
      const v = params.get(k);
      if (v) picked[k] = v;
    });

    if (picked.email && EMAIL_RE.test(picked.email)) setEmail(picked.email);
    if (picked.articleUrl) {
      resolveUrl(picked.articleUrl);
    }
    setPrefill(picked);

    if (Object.keys(picked).length) {
      fetch('/api/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(picked),
      }).catch(() => {
        /* cookie is optional — context still travels with /api/auth/start */
      });
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  async function resolveUrl(url) {
    setResolving(true);
    setArticleError(null);
    try {
      const res = await fetch('/api/article/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || STEP_ARTICLE.parseFail);

      setSources((prev) => [
        ...prev,
        {
          type: 'url',
          value: url,
          display: data.headline || url,
          meta: data.outlet
            ? [data.outlet, data.date].filter(Boolean).join(' · ')
            : STEP_ARTICLE.parsePartial,
        },
      ]);
    } catch (err) {
      setArticleError(err.message);
    } finally {
      setResolving(false);
    }
  }

  const addSource = (s) => {
    if (s.type === 'url') {
      resolveUrl(s.value);
      return;
    }
    setSources((prev) => [
      ...prev,
      s.type === 'text'
        ? {
            ...s,
            display: 'Article text',
            meta: `${s.value.trim().split(/\s+/).length} words`,
          }
        : { ...s, display: s.value, meta: 'PDF attached' },
    ]);
  };

  async function sendCode(e) {
    e.preventDefault();
    if (!email.trim()) return setEmailError(STEP_EMAIL.empty);
    if (!EMAIL_RE.test(email.trim())) return setEmailError(STEP_EMAIL.invalid);

    setSending(true);
    setEmailError(null);
    try {
      const res = await fetch('/api/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          // Article + milestone captured pre-gate travel with the request so
          // nothing is lost if they verify on another device.
          context: {
            articleUrl: sources.find((s) => s.type === 'url')?.value || prefill.articleUrl || '',
            articleText: sources.find((s) => s.type === 'text')?.value || '',
            announcementType: milestone === 'Something else' ? milestoneOther : milestone,
            companyName: prefill.companyName || '',
            quote: prefill.quote || '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || STEP_EMAIL.failed);
      router.push(`/start/verify?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setEmailError(err.message);
      setSending(false);
    }
  }

  const canContinue = sources.length > 0 || (milestone && (milestone !== 'Something else' || milestoneOther.trim()));

  return (
    <div className="bezel">
      <div className="bezel-core p-6 sm:p-9">
        {stage === 'article' && (
          <>
            <span className="eyebrow eyebrow-dot">{STEP_ARTICLE.eyebrow}</span>
            <h1 className="mt-6 text-[2rem] leading-[1.02] sm:text-[2.5rem]">{STEP_ARTICLE.h1}</h1>
            <p className="mt-4 text-[1rem] leading-relaxed text-white/55">{STEP_ARTICLE.sub}</p>

            <div className="mt-7">
              <ArticleDrop
                sources={sources}
                onAdd={addSource}
                onRemove={(i) => setSources((prev) => prev.filter((_, x) => x !== i))}
                resolving={resolving}
                error={articleError}
              />
            </div>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStage('milestone')}
                className="text-left text-[0.88rem] text-echo-mint/85 transition-colors duration-300 hover:text-echo-mint"
              >
                {STEP_ARTICLE.noArticle} →
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStage('email')}
                className="btn btn-primary justify-between sm:justify-start"
              >
                {STEP_ARTICLE.cta}
                <span className="btn-nib">
                  <ArrowRight />
                </span>
              </button>
            </div>
          </>
        )}

        {stage === 'milestone' && (
          <>
            <span className="eyebrow eyebrow-dot">{STEP_ARTICLE.eyebrow}</span>
            <h1 className="mt-6 text-[2rem] leading-[1.02] sm:text-[2.5rem]">
              {STEP_MILESTONE.h1}
            </h1>

            <ul className="mt-7 space-y-2.5">
              {MILESTONES.map((m) => {
                const active = milestone === m.value;
                return (
                  <li key={m.value}>
                    <button
                      type="button"
                      onClick={() => setMilestone(m.value)}
                      className="w-full rounded-2xl px-5 py-4 text-left text-[0.98rem] transition-all duration-500 ease-haptic"
                      style={{
                        background: active ? 'rgba(127,240,192,0.09)' : 'rgba(255,255,255,0.024)',
                        boxShadow: `inset 0 0 0 1px ${
                          active ? 'rgba(127,240,192,0.42)' : 'rgba(255,255,255,0.08)'
                        }`,
                        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {m.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            {milestone === 'Something else' && (
              <div className="mt-5">
                <label className="field-label" htmlFor="milestoneOther">
                  {STEP_MILESTONE.otherLabel}
                </label>
                <input
                  id="milestoneOther"
                  name="milestoneOther"
                  value={milestoneOther}
                  onChange={(e) => setMilestoneOther(e.target.value)}
                  placeholder={STEP_MILESTONE.otherPlaceholder}
                  className="field"
                />
              </div>
            )}

            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStage('article')}
                className="text-left text-[0.88rem] text-white/45 transition-colors duration-300 hover:text-white"
              >
                {STEP_MILESTONE.backToArticle}
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStage('email')}
                className="btn btn-primary justify-between sm:justify-start"
              >
                {STEP_ARTICLE.cta}
                <span className="btn-nib">
                  <ArrowRight />
                </span>
              </button>
            </div>
          </>
        )}

        {stage === 'email' && (
          <form onSubmit={sendCode}>
            <span className="eyebrow eyebrow-dot">{STEP_EMAIL.eyebrow}</span>
            <h1 className="mt-6 text-[2rem] leading-[1.02] sm:text-[2.5rem]">{STEP_EMAIL.h1}</h1>
            <p className="mt-4 text-[1rem] leading-relaxed text-white/55">{STEP_EMAIL.sub}</p>

            {sources.length > 0 && (
              <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-echo-mint">
                ✓ {sources[0].display}
              </p>
            )}

            <div className="mt-7">
              <label className="field-label" htmlFor="email">
                {STEP_EMAIL.label}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder={STEP_EMAIL.placeholder}
                className="field"
              />
              {emailError && (
                <p role="alert" className="mt-2.5 text-[0.82rem] text-amber-200/85">
                  {emailError}
                </p>
              )}
            </div>

            <button type="submit" disabled={sending} className="btn btn-primary mt-6 w-full justify-between">
              {sending ? STEP_EMAIL.ctaLoading : STEP_EMAIL.cta}
              <span className="btn-nib">
                <ArrowUpRight />
              </span>
            </button>

            <p className="mt-4 text-center text-[0.85rem] text-white/45">{STEP_EMAIL.reassure}</p>

            <div className="mt-7 rule" />
            <p className="mt-5 font-mono text-[10px] uppercase tracking-eyebrow text-white/32">
              {STEP_EMAIL.priceLine}
            </p>
            <p className="mt-3 text-[0.82rem] leading-relaxed text-white/40">
              {STEP_EMAIL.promise}
            </p>

            <button
              type="button"
              onClick={() => setStage(sources.length ? 'article' : 'milestone')}
              className="mt-5 text-[0.82rem] text-white/38 transition-colors duration-300 hover:text-white"
            >
              ← {STEP_EMAIL.changeArticle}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
