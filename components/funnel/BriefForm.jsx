'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ArticleDrop from './ArticleDrop';
import LogoUpload from './LogoUpload';
import ComposeWait from './ComposeWait';
import {
  briefToFormState,
  hasResumableBrief,
  mergeBriefFormState,
  sourcesToBriefPatch,
} from '../../lib/brief-shape';
import { BRIEF, FIELDS, ANNOUNCEMENT_CHIPS } from '../../lib/funnel';
import { ArrowUpRight } from '../Icons';

const REQUIRED = ['companyName', 'contactName', 'contactEmail', 'announcementType'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * One page, three sections — not a wizard. Wizards imply unknown length and
 * owners abandon unknown length; a single scroll with three headed sections is
 * visibly finite.
 *
 * Field order is easy → factual → creative. The quote is last because it's the
 * only field that requires thought, and it needs momentum behind it.
 */
export default function BriefForm({ initial = {} }) {
  const router = useRouter();
  const { sources: initialSources = [], ...initialValues } = initial;
  const [values, setValues] = useState({
    companyName: '',
    website: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    announcementType: '',
    quote: '',
    quoteAttribution: '',
    notes: '',
    ...initialValues,
  });
  const [sources, setSources] = useState(initialSources);
  const [logo, setLogo] = useState(null);
  const [logoError, setLogoError] = useState(null);
  const [save, setSave] = useState('idle'); // idle | saving | failed
  const [errors, setErrors] = useState({});
  const [showNotes, setShowNotes] = useState(Boolean(initial.notes));
  const [composing, setComposing] = useState(false);
  const [resumed, setResumed] = useState(hasResumableBrief(initial));
  const [active, setActive] = useState('business');
  const debounce = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    if (!resumed) return undefined;
    const t = setTimeout(() => setResumed(false), 4000);
    return () => clearTimeout(t);
  }, [resumed]);

  /** Client resume: GET /api/brief even if SSR `initial` was empty. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/brief', { method: 'GET', cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace('/start');
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const brief = data?.brief;
        if (!hasResumableBrief(brief)) return;
        const incoming = briefToFormState(brief);
        setValues((prev) => mergeBriefFormState({ values: prev, sources: [] }, incoming).values);
        setSources((prev) => mergeBriefFormState({ values: {}, sources: prev }, incoming).sources);
        if (incoming.values.notes) setShowNotes(true);
        setResumed(true);
        const hash = window.location.hash.replace(/^#/, '');
        if (hash) {
          requestAnimationFrame(() => {
            document.getElementById(hash)?.scrollIntoView({ block: 'start' });
          });
        }
      } catch {
        /* keep SSR initial */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Track which section is in view for the rail. */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-25% 0px -60% 0px' }
    );
    BRIEF.sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  /** Per-field autosave. Partial records are the normal case, not an error. */
  async function persist(patch) {
    setSave('saving');
    try {
      const res = await fetch('/api/brief', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) {
        router.replace('/start');
        return false;
      }
      if (!res.ok) throw new Error('save failed');
      setSave('idle');
      return true;
    } catch {
      setSave('failed');
      return false;
    }
  }

  /**
   * The logo is a binary and cannot ride the JSON autosave, so it goes straight
   * to its own endpoint. Returning a string tells LogoUpload to surface it as
   * the field error and drop the success chip — otherwise a failed upload still
   * looks like it worked.
   */
  async function uploadLogo(file) {
    if (!file) return undefined;
    setLogo(file);
    setLogoError(null);
    setSave('saving');
    try {
      const body = new FormData();
      body.append('logo', file);
      const res = await fetch('/api/logo', { method: 'POST', body });
      if (res.status === 401) {
        router.replace('/start');
        return undefined;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok !== true) throw new Error(data.error || 'We could not save your logo.');
      setSave('idle');
      return undefined;
    } catch (err) {
      setLogo(null);
      setSave('failed');
      const message = err?.message || 'We could not save your logo.';
      setLogoError(message);
      return message;
    }
  }

  const set = (name) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((x) => ({ ...x, [name]: null }));
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => persist({ [name]: value }), 2000);
  };

  const blurSave = (name) => () => {
    clearTimeout(debounce.current);
    persist({ [name]: values[name] });
  };

  function validate() {
    const next = {};
    REQUIRED.forEach((f) => {
      if (!String(values[f] || '').trim()) next[f] = true;
    });
    if (values.contactEmail && !EMAIL_RE.test(values.contactEmail)) {
      next.contactEmail = FIELDS.contactEmail.invalid;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function complete(e) {
    e.preventDefault();
    if (!validate()) {
      const first = REQUIRED.find((f) => !String(values[f] || '').trim());
      document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(first)?.focus({ preventScroll: true });
      return;
    }
    // ComposeWait POSTs /api/brief/complete with no body: it composes purely
    // from stored lead state. Anything still sitting in the 2s debounce, and
    // the whole `sources` list, has to land server-side first.
    clearTimeout(debounce.current);
    const saved = await persist({ ...values, ...sourcesToBriefPatch(sources) });
    if (!saved) return; // save chip reads "failed" — don't compose from stale data
    setComposing(true);
  }

  if (composing) {
    return (
      <ComposeWait
        onDone={(token) => router.push(token ? `/preview/${token}` : '/preview')}
        onCancel={() => setComposing(false)}
      />
    );
  }

  return (
    <form onSubmit={complete}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <span className="eyebrow eyebrow-dot">{BRIEF.eyebrow}</span>
          <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">{BRIEF.h1}</h1>
          <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/55">{BRIEF.sub}</p>
        </div>
      </div>

      {resumed && (
        <p className="mt-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.82rem] text-echo-mint"
           style={{ background: 'rgba(127,240,192,0.08)', boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.25)' }}>
          {BRIEF.resume}
        </p>
      )}

      <div className="mt-10 gap-10 lg:flex">
        {/* Section rail — visibly finite */}
        <nav className="mb-8 lg:mb-0 lg:w-40 lg:shrink-0">
          <ol className="flex gap-4 lg:sticky lg:top-8 lg:flex-col lg:gap-3">
            {BRIEF.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2 transition-colors duration-500 ease-haptic"
                  style={{ color: active === s.id ? '#7ff0c0' : 'rgba(255,255,255,0.35)' }}
                >
                  <span className="font-mono text-[10px] tracking-eyebrow">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="hidden text-[0.85rem] lg:inline">{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 flex-1 space-y-12">
          {/* ---- Section 1: the business ---- */}
          <section id="business" ref={(el) => (sectionRefs.current.business = el)}>
            <h2 className="text-[1.4rem] sm:text-[1.7rem]">{BRIEF.sections[0].label}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                name="companyName"
                spec={FIELDS.companyName}
                value={values.companyName}
                onChange={set('companyName')}
                onBlur={blurSave('companyName')}
                error={errors.companyName && FIELDS.companyName.empty}
                required
                autoFocus
              />
              <Field
                name="website"
                spec={FIELDS.website}
                value={values.website}
                onChange={set('website')}
                onBlur={blurSave('website')}
              />
              <Field
                name="contactName"
                spec={FIELDS.contactName}
                value={values.contactName}
                onChange={set('contactName')}
                onBlur={blurSave('contactName')}
                error={errors.contactName && 'We need a name for reporters to ask for.'}
                required
              />
              <Field
                name="contactEmail"
                spec={FIELDS.contactEmail}
                type="email"
                value={values.contactEmail}
                onChange={set('contactEmail')}
                onBlur={blurSave('contactEmail')}
                error={
                  errors.contactEmail === true
                    ? 'We need somewhere to send the draft.'
                    : errors.contactEmail
                }
                required
              />
              <Field
                name="phone"
                spec={FIELDS.phone}
                type="tel"
                value={values.phone}
                onChange={set('phone')}
                onBlur={blurSave('phone')}
              />
              <div className="sm:col-span-2">
                <LogoUpload onChange={uploadLogo} error={logoError} />
              </div>
            </div>
          </section>

          {/* ---- Section 2: the news ---- */}
          <section id="news" ref={(el) => (sectionRefs.current.news = el)}>
            <h2 className="text-[1.4rem] sm:text-[1.7rem]">{BRIEF.sections[1].label}</h2>

            <div className="mt-6">
              <ArticleDrop
                sources={sources}
                onAdd={(s) => {
                  const next = [
                    ...sources,
                    { ...s, display: s.type === 'text' ? 'Article text' : s.value },
                  ];
                  setSources(next);
                  persist(sourcesToBriefPatch(next));
                }}
                onRemove={(i) => {
                  const next = sources.filter((_, x) => x !== i);
                  setSources(next);
                  persist(sourcesToBriefPatch(next));
                }}
              />
            </div>

            <div className="mt-6">
              <span className="field-label">
                {FIELDS.announcementType.label} <span className="text-echo-mint">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {ANNOUNCEMENT_CHIPS.map((chip) => {
                  const on = values.announcementType === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setValues((v) => ({ ...v, announcementType: chip }));
                        setErrors((x) => ({ ...x, announcementType: null }));
                        persist({ announcementType: chip });
                      }}
                      className="rounded-full px-4 py-2 text-[0.85rem] transition-all duration-500 ease-haptic"
                      style={{
                        background: on ? 'rgba(127,240,192,0.1)' : 'rgba(255,255,255,0.028)',
                        boxShadow: `inset 0 0 0 1px ${
                          on ? 'rgba(127,240,192,0.42)' : 'rgba(255,255,255,0.08)'
                        }`,
                        color: on ? '#fff' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="announcementType" value={values.announcementType} />
              {errors.announcementType && (
                <p role="alert" className="mt-2 text-[0.82rem] text-amber-200/85">
                  Pick the one that fits closest — we’ll sort out the details.
                </p>
              )}
            </div>

            <div className="mt-6">
              {showNotes ? (
                <>
                  <label className="field-label" htmlFor="notes">
                    {FIELDS.notes.label}
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={values.notes}
                    onChange={set('notes')}
                    onBlur={blurSave('notes')}
                    placeholder={FIELDS.notes.placeholder}
                    className="field resize-y"
                  />
                  <p className="mt-2 text-[0.78rem] leading-relaxed text-white/32">
                    {FIELDS.notes.hint}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="btn btn-ghost text-[0.85rem]"
                >
                  {FIELDS.notes.toggle}
                  <span className="btn-nib">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* ---- Section 3: in your words ---- */}
          <section id="words" ref={(el) => (sectionRefs.current.words = el)}>
            <h2 className="text-[1.4rem] sm:text-[1.7rem]">{BRIEF.sections[2].label}</h2>

            <div className="mt-6">
              <label className="field-label" htmlFor="quote">
                {FIELDS.quote.label}
              </label>
              <textarea
                id="quote"
                name="quote"
                rows={4}
                value={values.quote}
                onChange={set('quote')}
                onBlur={blurSave('quote')}
                placeholder={FIELDS.quote.placeholder}
                className="field resize-y"
              />
              <p className="mt-2 text-[0.78rem] leading-relaxed text-white/32">
                {FIELDS.quote.hint}
              </p>
            </div>

            {/* One field that grows a follow-up is a conversation; two fields
                for one question is confusing. */}
            <div
              className="overflow-hidden transition-all duration-500 ease-spring"
              style={{
                maxHeight: values.quote.trim().length > 10 ? '12rem' : '0rem',
                opacity: values.quote.trim().length > 10 ? 1 : 0,
              }}
            >
              <div className="pt-5">
                <Field
                  name="quoteAttribution"
                  spec={FIELDS.quoteAttribution}
                  value={values.quoteAttribution}
                  onChange={set('quoteAttribution')}
                  onBlur={blurSave('quoteAttribution')}
                />
              </div>
            </div>
          </section>

          <div className="rule" />

          <div className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => persist(values)}
              className="text-left text-[0.85rem] text-white/40 transition-colors duration-300 hover:text-white"
            >
              {BRIEF.saveLater}
            </button>
            <button type="submit" className="btn btn-primary w-full justify-between sm:w-auto">
              {BRIEF.cta}
              <span className="btn-nib">
                <ArrowUpRight />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Autosave status: one quiet word, never a toast */}
      <p
        className="pointer-events-none fixed bottom-4 right-5 font-mono text-[10px] uppercase tracking-eyebrow"
        style={{ color: save === 'failed' ? 'rgba(253,230,138,0.8)' : 'rgba(255,255,255,0.32)' }}
      >
        {save === 'saving' ? BRIEF.saving : save === 'failed' ? BRIEF.saveFailed : BRIEF.savedIdle}
      </p>
    </form>
  );
}

function Field({ name, spec, value, onChange, onBlur, error, required, type = 'text', autoFocus }) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {spec.label} {required && <span className="text-echo-mint">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={spec.placeholder}
        autoFocus={autoFocus}
        className="field"
      />
      {error ? (
        <p role="alert" className="mt-2 text-[0.8rem] text-amber-200/85">
          {error}
        </p>
      ) : spec.hint ? (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-white/32">{spec.hint}</p>
      ) : null}
    </div>
  );
}
