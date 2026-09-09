'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PREVIEW, nextSendDay } from '../../lib/draft';
import { BRIEF_EDIT_HREF } from '../../lib/funnel';
import { ArrowUpRight, ArrowRight, Check, Shield } from '../Icons';
import ApprovalCheckbox from './ApprovalCheckbox';

export default function PreviewScreen({
  draft,
  token,
  price = '$499',
  requiresApproval = false,
  alreadyApproved = false,
  canApprove = false,
  signedIn = false,
  showApproveNotice = false,
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(Boolean(alreadyApproved));
  const day = nextSendDay();
  const canCheckout = !requiresApproval || approved;

  async function share() {
    const url = `${window.location.origin}/preview/${token}?shared=1`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Draft press release', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  function goToCheckout() {
    if (!canCheckout) return;
    router.push(`/checkout?token=${encodeURIComponent(token || 'demo')}`);
  }

  return (
    <>
      <span className="eyebrow eyebrow-dot">{PREVIEW.eyebrow}</span>
      <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">{PREVIEW.h1}</h1>
      <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/55">{PREVIEW.sub}</p>

      <figure className="mt-10">
        <div className="bezel">
          <div className="bezel-core overflow-hidden p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/preview/${token}/plate`}
              alt="Your press release on your letterhead"
              className="block w-full rounded-[calc(2rem-0.75rem)]"
              draggable={false}
              style={{ userSelect: 'none' }}
            />
          </div>
        </div>
        <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-eyebrow text-white/30">
          {PREVIEW.plateCaption}
        </figcaption>
      </figure>

      <article className="mt-12">
        <div className="rule" />
        <div className="mx-auto mt-10 max-w-[38rem]">
          <h2 className="font-display text-[1.7rem] leading-[1.15] text-white sm:text-[2.1rem]">
            {draft.headline}
          </h2>
          {draft.subhead ? (
            <p className="mt-4 font-display text-[1.1rem] italic leading-snug text-white/60">
              {draft.subhead}
            </p>
          ) : null}

          <p className="mt-8 text-[1.02rem] leading-[1.75] text-white/72">
            <span className="font-medium text-white/90">{draft.dateline}</span> —{' '}
            {draft.bodyParagraphs[0]}
          </p>

          {draft.bodyParagraphs.slice(1).map((p, i) => (
            <p key={i} className="mt-5 text-[1.02rem] leading-[1.75] text-white/72">
              {p}
            </p>
          ))}

          {draft.quote ? (
            <p className="mt-6 text-[1.02rem] leading-[1.75] text-white/72">
              “{draft.quote}”
              {draft.quoteAttribution ? ` — ${draft.quoteAttribution}` : ''}
            </p>
          ) : null}

          <p className="mt-8 font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
            About {draft.companyName}
          </p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-white/50">{draft.boilerplate}</p>

          <p className="mt-8 font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
            Media contact
          </p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-white/50">
            {draft.contactName}
            <br />
            {draft.contactEmail}
            {draft.phone ? (
              <>
                <br />
                {draft.phone}
              </>
            ) : null}
          </p>
        </div>
      </article>

      <div className="mt-10 rule" />

      {requiresApproval && !approved ? (
        <p
          role={showApproveNotice ? 'status' : undefined}
          className="mt-8 max-w-xl text-[0.92rem] leading-relaxed text-white/60"
        >
          {canApprove
            ? PREVIEW.approveNotice
            : signedIn
              ? PREVIEW.approveOwner
              : PREVIEW.approveSignIn}
        </p>
      ) : null}

      {requiresApproval && canApprove && !approved ? (
        <div className="mt-6 max-w-2xl">
          <ApprovalCheckbox onApproved={() => setApproved(true)} context="preview" />
        </div>
      ) : null}

      {requiresApproval && approved ? (
        <p className="mt-6 flex items-center gap-2 text-[0.9rem] font-medium text-echo-mint">
          <Check width={14} height={14} /> {PREVIEW.approvedReady}
        </p>
      ) : null}

      {requiresApproval && !signedIn ? (
        <div className="mt-6">
          <Link href="/start" className="btn btn-ghost w-full justify-between sm:w-auto">
            Sign in to approve
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </Link>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <button
              type="button"
              onClick={goToCheckout}
              disabled={!canCheckout}
              className="btn btn-primary w-full justify-between sm:w-auto disabled:cursor-not-allowed disabled:opacity-40"
            >
              {PREVIEW.primary}
              <span className="btn-nib">
                <ArrowRight />
              </span>
            </button>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-eyebrow text-white/32 sm:text-left">
              {canCheckout ? PREVIEW.primarySub(price, day) : PREVIEW.approveNext}
            </p>
          </div>
          <Link href={BRIEF_EDIT_HREF} className="btn btn-ghost w-full justify-between sm:w-auto">
            {PREVIEW.secondary}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </Link>
        </div>

        {/* Replaces Print — the job Print was actually doing is "show my
            business partner before I spend money". */}
        <div className="sm:text-right">
          <button
            type="button"
            onClick={share}
            className="text-[0.88rem] text-echo-mint/85 transition-colors duration-300 hover:text-echo-mint"
          >
            {copied ? PREVIEW.shareCopied : PREVIEW.share}
          </button>
          <p className="mt-1.5 text-[0.78rem] text-white/32">{PREVIEW.shareSub}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-white/35">
        <span className="flex items-center gap-2 text-[0.8rem]">
          <Shield width={12} height={12} /> {PREVIEW.humanNote}
        </span>
        <span className="flex items-center gap-2 text-[0.8rem]">
          <Check width={12} height={12} /> {PREVIEW.accountNote}
        </span>
      </div>
    </>
  );
}
