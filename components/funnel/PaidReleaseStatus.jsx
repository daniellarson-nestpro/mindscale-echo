'use client';

import { useState } from 'react';
import StatusLadder from './StatusLadder';
import ApprovalCheckbox from './ApprovalCheckbox';
import { Check } from '../Icons';
import { displayOrderStatus } from '../../lib/approval.js';

/**
 * Post-pay account status. Approval is the preview-page path; this only
 * shows a checkbox as a fallback when someone paid without approving.
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

  const showFallbackCheckbox =
    !approved && status === 'paid';

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

      {approved ? (
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
            {approvedAtLocal ? ` on ${new Date(approvedAtLocal).toLocaleDateString()}` : ''}.
            {status === 'pr_sent'
              ? ' It has been submitted to the vendor.'
              : ' It is queued for manual vendor submission.'}
          </p>
        </div>
      ) : showFallbackCheckbox ? (
        <div className="max-w-2xl">
          <p className="mb-3 text-[0.88rem] leading-relaxed text-white/50">
            This release is paid but not approved yet.{' '}
            <a href={previewHref} className="text-echo-mint/85 underline-offset-4 hover:underline">
              Review the draft
            </a>
            , then approve it here.
          </p>
          <ApprovalCheckbox onApproved={handleApproved} context="account" />
        </div>
      ) : null}
    </>
  );
}
