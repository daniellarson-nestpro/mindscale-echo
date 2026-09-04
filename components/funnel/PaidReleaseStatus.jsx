'use client';

import { useState } from 'react';
import StatusLadder from './StatusLadder';
import ApprovalCheckbox from './ApprovalCheckbox';
import { Check } from '../Icons';
import { displayOrderStatus } from '../../lib/approval.js';

/**
 * Client wrapper so a successful approve can update the status ladder
 * immediately. The account page is a Server Component and cannot pass
 * an onApproved callback; this component owns that callback.
 */

export default function PaidReleaseStatus({
  orderStatus,
  alreadyApproved = false,
  approvedAt = null,
  previewHref = '/preview',
}) {
  const initial = displayOrderStatus({ orderStatus, alreadyApproved });
  const [status, setStatus] = useState(initial);
  const [approved, setApproved] = useState(Boolean(alreadyApproved));
  const [approvedAtLocal, setApprovedAtLocal] = useState(approvedAt);

  function handleApproved(data) {
    setApproved(true);
    setStatus((prev) => (prev === 'pr_sent' ? prev : 'approved'));
    if (data?.approvedAt) setApprovedAtLocal(data.approvedAt);
  }

  const showCheckbox =
    !approved && status !== 'pr_sent' && status !== 'failed' && status !== 'refunded';

  return (
    <>
      {status ? (
        <div className="bezel">
          <div className="bezel-core p-7 sm:p-8">
            <h2 className="mb-6 text-[1.25rem] text-white/80">Release status</h2>
            <StatusLadder orderStatus={status} />
          </div>
        </div>
      ) : null}

      {showCheckbox ? (
        <div className="max-w-2xl">
          <div className="mb-3">
            <a href={previewHref} className="btn btn-ghost text-[0.88rem]">
              ← Review your press release first
            </a>
          </div>
          <ApprovalCheckbox onApproved={handleApproved} />
        </div>
      ) : approved ? (
        <div
          className="max-w-2xl rounded-[1.5rem] p-5"
          style={{
            background: 'rgba(127,240,192,0.06)',
            boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22)',
          }}
        >
          <p className="flex items-center gap-2 text-[0.9rem] font-medium text-echo-mint">
            <Check width={14} height={14} /> Release approved
          </p>
          <p className="mt-1 text-[0.82rem] text-white/50">
            You approved this press release
            {approvedAtLocal ? ` on ${new Date(approvedAtLocal).toLocaleDateString()}` : ''}. It is
            queued for manual vendor submission.
          </p>
          {status === 'pr_sent' && (
            <p className="mt-2 text-[0.82rem] text-echo-mint/80">
              Your press release has been submitted to the vendor.
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
