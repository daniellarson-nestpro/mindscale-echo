'use client';

import { useState } from 'react';
import { ArrowUpRight } from './Icons';

export default function LoginForm({ prefillEmail = '' }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [devLoginUrl, setDevLoginUrl] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setError(null);
    setDevLoginUrl('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not send a login link.');
      if (json.devLoginUrl) setDevLoginUrl(json.devLoginUrl);
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="bezel bezel-accent">
        <div
          className="rounded-core p-8 sm:p-12"
          style={{
            background: 'linear-gradient(150deg, rgba(13,13,17,0.94), rgba(8,8,11,0.97))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
          }}
        >
          <span className="eyebrow eyebrow-dot">Check your email</span>
          <h2 className="mt-6 text-[2rem] leading-tight sm:text-[2.4rem]">
            <span className="text-gradient">Link sent.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[1rem] leading-relaxed text-white/60">
            If that email has a purchase, we sent a one-time login link. It expires in 30 minutes.
            Use the same address from your Stripe receipt.
          </p>
          {devLoginUrl && (
            <p className="mt-6 text-[0.82rem] leading-relaxed text-white/45">
              Development only — email was not required.{' '}
              <a href={devLoginUrl} className="text-echo-mint underline-offset-4 hover:underline">
                Open the login link
              </a>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bezel block">
      <div className="bezel-core p-6 sm:p-9">
        <label className="field-label" htmlFor="email">
          Email <span className="text-echo-mint">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={prefillEmail}
          placeholder="you@company.com"
          className="field"
          autoComplete="email"
        />
        <p className="mt-2 text-[0.76rem] leading-relaxed text-white/32">
          We’ll email a one-time link. No password.
        </p>

        {error && (
          <p role="alert" className="mt-6 text-[0.85rem] text-rose-300/85">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-[0.78rem] leading-relaxed text-white/32">
            Workspace access is tied to the email collected at checkout.
          </p>
          <button type="submit" className="btn btn-primary w-full sm:w-max" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending link…' : 'Email me a login link'}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
