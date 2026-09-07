'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VERIFY } from '../../lib/funnel';
import { ArrowUpRight, Check } from '../Icons';

/**
 * Code entry plus name/phone on one screen. The inbox round-trip is dead air,
 * so it collects the two fields we needed anyway — and if they bail after the
 * code is sent but before verifying, we still hold name and phone.
 *
 * The code and the emailed link are two keys to one attempt. Copy says "the
 * same email has a sign-in link" — never "the same code".
 */
export default function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | wrong | expired | done
  const [cooldown, setCooldown] = useState(45);
  const [showSpam, setShowSpam] = useState(false);
  const [shake, setShake] = useState(false);
  const codeRef = useRef(null);
  const savedProfile = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    const spam = setTimeout(() => setShowSpam(true), 20000);
    return () => {
      clearInterval(t);
      clearTimeout(spam);
    };
  }, []);

  /**
   * Cross-device: they may open the emailed link on their phone while this tab
   * waits. Poll so this tab advances itself instead of stranding them.
   */
  useEffect(() => {
    if (state === 'done') return undefined;
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/session/status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified) {
          clearInterval(poll);
          setState('done');
          router.push(data.redirectTo || '/brief');
        }
      } catch {
        /* offline is fine — keep polling */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [state, router]);

  /** Persist name/phone against the pending attempt, pre-verification. */
  async function saveProfile() {
    if (savedProfile.current) return;
    if (!name.trim() && !phone.trim()) return;
    savedProfile.current = true;
    try {
      await fetch('/api/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          resend: false,
          prefill: { contactName: name.trim(), phone: phone.trim() },
        }),
      });
    } catch {
      /* non-fatal: verification still works */
    } finally {
      savedProfile.current = false;
    }
  }

  async function submit(value) {
    setState('checking');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: value,
          prefill: { contactName: name.trim(), phone: phone.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState(data.expired ? 'expired' : 'wrong');
        setShake(true);
        setTimeout(() => setShake(false), 340);
        return;
      }
      setState('done');
      router.push(data.next || data.redirectTo || '/brief');
    } catch {
      setState('wrong');
    }
  }

  async function resend() {
    setCooldown(45);
    setState('idle');
    setCode('');
    await fetch('/api/auth/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resend: true }),
    });
    codeRef.current?.focus();
  }

  if (state === 'expired') {
    return (
      <div className="bezel">
        <div className="bezel-core p-8 text-center sm:p-12">
          <span className="eyebrow">Code expired</span>
          <h1 className="mt-6 text-[2rem] leading-tight sm:text-[2.4rem]">{VERIFY.expiredH1}</h1>
          <p className="mx-auto mt-4 max-w-sm text-[1rem] leading-relaxed text-white/55">
            {VERIFY.expiredSub}
          </p>
          <button type="button" onClick={resend} className="btn btn-primary mx-auto mt-8">
            {VERIFY.resend}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bezel">
      <div className="bezel-core p-6 sm:p-9">
        <h1 className="text-[2rem] leading-[1.02] sm:text-[2.4rem]">{VERIFY.h1}</h1>
        <p className="mt-4 text-[1rem] leading-relaxed text-white/55">
          {VERIFY.sub(email || 'your inbox')}
        </p>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-white/40">{VERIFY.linkNote}</p>

        <div className="mt-7">
          <label className="field-label" htmlFor="code">
            {VERIFY.codeLabel}
          </label>
          <input
            ref={codeRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(next);
              if (state === 'wrong') setState('idle');
              // Autosubmit: never make someone press a button after typing a
              // code they already know is right.
              if (next.length === 6) submit(next);
            }}
            placeholder={VERIFY.codePlaceholder}
            className={`field text-center text-2xl ${shake ? 'field-shake' : ''}`}
            style={{ letterSpacing: '0.4em', fontVariantNumeric: 'tabular-nums' }}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-white/30">
              {state === 'checking' ? 'Checking…' : VERIFY.expiryNote}
            </span>
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0}
              className="text-[0.82rem] text-echo-mint/85 transition-colors duration-300 hover:text-echo-mint disabled:text-white/25"
            >
              {cooldown > 0 ? VERIFY.resendWait(cooldown) : VERIFY.resend}
            </button>
          </div>

          {state === 'wrong' && (
            <p role="alert" className="mt-3 text-[0.85rem] leading-relaxed text-amber-200/85">
              {VERIFY.wrongCode}
            </p>
          )}
          {showSpam && state !== 'wrong' && (
            <p className="mt-3 text-[0.82rem] leading-relaxed text-white/38">{VERIFY.spamNudge}</p>
          )}

          <a
            href={`/start?email=${encodeURIComponent(email)}`}
            className="mt-4 inline-block text-[0.82rem] text-white/38 transition-colors duration-300 hover:text-white"
          >
            {VERIFY.changeEmail}
          </a>
        </div>

        <div className="mt-8 rule" />

        {/* The wait, filled. */}
        <p className="mt-7 font-display text-[1.15rem] text-white/70">{VERIFY.waitHeading}</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="contactName">
              {VERIFY.nameLabel}
            </label>
            <input
              id="contactName"
              name="contactName"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveProfile}
              placeholder={VERIFY.namePlaceholder}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="phone">
              {VERIFY.phoneLabel}{' '}
              <span className="normal-case tracking-normal text-white/30">
                {VERIFY.phoneOptional}
              </span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={saveProfile}
              placeholder={VERIFY.phonePlaceholder}
              className="field"
            />
          </div>
        </div>

        <p className="mt-3 text-[0.78rem] leading-relaxed text-white/32">{VERIFY.phoneHint}</p>

        {state === 'done' && (
          <p className="mt-6 flex items-center gap-2 text-[0.9rem] text-echo-mint">
            <Check width={14} height={14} /> {VERIFY.verified}
          </p>
        )}
      </div>
    </div>
  );
}
