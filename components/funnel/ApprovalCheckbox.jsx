'use client';

import { useState } from 'react';
import { APPROVAL_CHECKBOX_COPY as CHECKBOX_COPY } from '../../lib/approval.js';

/**
 * Final approval checkbox with clear disclaimers.
 * Distinguishes between "Approved by customer" and "PR sent to vendor."
 */
export default function ApprovalCheckbox({ onApproved, loading }) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleApprove() {
    if (!checked) {
      setError('Please check the box to confirm you have reviewed the press release.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not record approval. Please try again.');
        return;
      }
      onApproved?.(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-[1.5rem] p-6"
      style={{
        background: 'rgba(255,255,255,0.022)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
      }}
    >
      <p className="mb-4 text-[0.95rem] font-medium text-white/90">Final approval</p>

      <div
        className="mb-4 rounded-2xl p-4 text-[0.82rem] leading-relaxed text-amber-100/75"
        style={{ background: 'rgba(251,191,36,0.06)', boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.18)' }}
      >
        <strong className="block mb-1 text-amber-200/90">Before you approve</strong>
        Approving marks your press release as ready for manual vendor submission. Mindscale Echo may
        be able to stop distribution after submission in limited circumstances, but{' '}
        <strong>cannot issue a refund after vendor submission</strong> because fulfillment has
        already been paid for. Please review the release carefully above before checking the box.
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setChecked(e.target.checked);
            if (error) setError(null);
          }}
          className="mt-[0.15rem] h-4 w-4 shrink-0 rounded border-white/20 bg-white/05 accent-emerald-400"
          disabled={submitting || loading}
        />
        <span className="text-[0.82rem] leading-relaxed text-white/65">{CHECKBOX_COPY}</span>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-[0.82rem] text-amber-200/80">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleApprove}
        disabled={!checked || submitting || loading}
        className="mt-5 w-full rounded-2xl py-3.5 text-[0.9rem] font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: checked ? 'rgba(127,240,192,0.18)' : 'rgba(255,255,255,0.06)', color: checked ? '#7ff0c0' : 'rgba(255,255,255,0.4)', boxShadow: checked ? 'inset 0 0 0 1px rgba(127,240,192,0.35)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
      >
        {submitting ? 'Recording approval…' : 'Approve and submit for fulfillment'}
      </button>
    </div>
  );
}
