'use client';

import { useState } from 'react';
import { ANNOUNCEMENT_TYPES } from '../lib/content';
import { ArrowUpRight, Check } from './Icons';

export default function OnboardingForm({ sessionId = '', plan = '', prefillEmail = '' }) {
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState(null);
  const [logoName, setLogoName] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    const data = new FormData(event.currentTarget);
    data.set('sessionId', sessionId);
    data.set('plan', plan);

    try {
      const res = await fetch('/api/onboarding', { method: 'POST', body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
      setStatus('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return <Confirmation />;
  }

  return (
    <form onSubmit={onSubmit} className="bezel block">
      <div className="bezel-core p-6 sm:p-9">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" name="companyName" required placeholder="Northline Coffee Co." />
          <Field
            label="Website"
            name="website"
            type="url"
            placeholder="https://northlinecoffee.com"
          />
          <Field label="Contact name" name="contactName" required placeholder="Dana Reyes" />
          <Field
            label="Contact email"
            name="contactEmail"
            type="email"
            required
            defaultValue={prefillEmail}
            placeholder="dana@northlinecoffee.com"
          />
          <div className="sm:col-span-2">
            <Field
              label="Article URL"
              name="articleUrl"
              type="url"
              placeholder="https://localpaper.com/northline-opens-second-location"
              hint="A recent article is ideal — if you don’t have one, describe the milestone in the notes below."
            />
          </div>

          <div>
            <label className="field-label" htmlFor="announcementType">
              Announcement type <span className="text-echo-mint">*</span>
            </label>
            <select id="announcementType" name="announcementType" required className="field" defaultValue="">
              <option value="" disabled>
                Select one…
              </option>
              {ANNOUNCEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Quote attribution"
            name="quoteAttribution"
            placeholder="Dana Reyes, Founder"
          />

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="quote">
              Preferred quote
            </label>
            <textarea
              id="quote"
              name="quote"
              rows={3}
              className="field resize-y"
              placeholder="“Opening our second location means…”"
            />
            <p className="mt-2 text-[0.76rem] text-white/32">
              Optional — we’ll draft one for your approval if you leave this blank.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="notes">
              Anything else we should know
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="field resize-y"
              placeholder="Embargo dates, spokespeople, product details, target regions…"
            />
          </div>

          <div className="sm:col-span-2">
            <span className="field-label">Logo upload</span>
            <label
              htmlFor="logo"
              className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-all duration-500 ease-haptic hover:bg-white/[0.04]"
              style={{
                background: 'rgba(255,255,255,0.022)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
              }}
            >
              <span className="text-[0.88rem] text-white/55">
                {logoName || 'PNG or SVG, up to 5 MB'}
              </span>
              <span className="btn-nib" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <ArrowUpRight />
              </span>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={(e) => setLogoName(e.target.files?.[0]?.name || '')}
              />
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-6 text-[0.85rem] text-rose-300/85">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-[0.78rem] leading-relaxed text-white/32">
            We prepare your draft for review. Nothing is distributed until you approve it.
          </p>
          <button type="submit" className="btn btn-primary w-full sm:w-max" disabled={status === 'sending'}>
            {status === 'sending' ? 'Submitting…' : 'Submit Release Brief'}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, name, hint, required, ...rest }) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label} {required && <span className="text-echo-mint">*</span>}
      </label>
      <input id={name} name={name} required={required} className="field" {...rest} />
      {hint && <p className="mt-2 text-[0.76rem] leading-relaxed text-white/32">{hint}</p>}
    </div>
  );
}

function Confirmation() {
  return (
    <div className="bezel bezel-accent">
      <div
        className="rounded-core p-8 text-center sm:p-14"
        style={{
          background: 'linear-gradient(150deg, rgba(13,13,17,0.94), rgba(8,8,11,0.97))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
        }}
      >
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-echo-mint"
          style={{
            background: 'rgba(127,240,192,0.14)',
            boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.34)',
          }}
        >
          <Check width={22} height={22} />
        </span>
        <h2 className="mt-7 text-[2rem] leading-tight sm:text-[2.6rem]">
          <span className="text-gradient">Brief received.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[1.02rem] leading-relaxed text-white/60">
          Your release request has been received. Our team will prepare your draft for review
          before distribution.
        </p>
        <a href="/" className="btn btn-ghost mt-9">
          Back to Mindscale Echo
          <span className="btn-nib">
            <ArrowUpRight />
          </span>
        </a>
      </div>
    </div>
  );
}
