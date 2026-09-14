import FunnelShell from '../../components/funnel/FunnelShell';
import { CALL } from '../../lib/draft';
import { SUPPORT_EMAIL } from '../../lib/funnel';
import { ArrowUpRight } from '../../components/Icons';

export const metadata = {
  title: 'Grab 30 minutes | Mindscale Echo',
  robots: { index: false, follow: false },
};

/**
 * Embeds the booking calendar when one is configured. Without one, the page
 * offers email — nothing else links here until NEXT_PUBLIC_CALENDAR_URL is set.
 */
export default function CallPage() {
  const url = process.env.NEXT_PUBLIC_CALENDAR_URL || '';

  return (
    <FunnelShell width="wide">
      <span className="eyebrow eyebrow-dot">No pitch</span>
      <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">{CALL.h1}</h1>
      <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/55">{CALL.body}</p>

      <div className="mt-10">
        <div className="bezel">
          {url ? (
            <div className="bezel-core overflow-hidden">
              <iframe
                src={url}
                title="Book a 30-minute call"
                className="h-[720px] w-full border-0"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="bezel-core p-8">
              <p className="text-[0.95rem] leading-relaxed text-white/60">{CALL.fallback}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('30 minutes — Mindscale Echo')}`}
                className="btn btn-primary mt-6"
              >
                Email {SUPPORT_EMAIL}
                <span className="btn-nib">
                  <ArrowUpRight />
                </span>
              </a>
            </div>
          )}
        </div>
      </div>
    </FunnelShell>
  );
}
