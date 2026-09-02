'use client';

import { useState } from 'react';
import { ArrowUpRight } from './Icons';

/**
 * Posts to /api/checkout, which creates a Stripe Checkout Session server-side
 * (secret key never reaches the browser) and returns the redirect URL.
 */
export default function CheckoutButton({ plan, label, variant = 'primary', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function launch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Checkout is unavailable right now.');
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={launch}
        disabled={loading}
        className={`btn w-full justify-between ${
          variant === 'primary' ? 'btn-primary' : 'btn-ghost'
        }`}
      >
        {loading ? 'Opening secure checkout…' : label}
        <span className="btn-nib">
          <ArrowUpRight />
        </span>
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[0.78rem] leading-relaxed text-rose-300/85">
          {error}
        </p>
      )}
    </div>
  );
}
