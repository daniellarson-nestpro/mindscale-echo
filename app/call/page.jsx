import FunnelShell from '../../components/funnel/FunnelShell';

export const metadata = {
  title: 'Book 30 minutes | Mindscale Echo',
  robots: { index: false, follow: false },
};

export default function CallPage() {
  const url = process.env.NEXT_PUBLIC_CALENDAR_URL;

  return (
    <FunnelShell width="wide">
      <span className="eyebrow eyebrow-dot">No pitch</span>
      <h1 className="mt-6 text-[2.1rem] leading-[1.02] sm:text-[2.6rem]">
        Grab 30 minutes with us.
      </h1>
      <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-white/55">
        We’ll look at your article together and tell you straight which package makes sense — or
        whether you should wait for a better story.
      </p>

      <div className="mt-10">
        {url ? (
          <div className="bezel">
            <div className="bezel-core overflow-hidden">
              <iframe
                src={url}
                title="Book a 30-minute call"
                className="h-[720px] w-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <div className="bezel">
            <div className="bezel-core p-8">
              <p className="text-[0.95rem] leading-relaxed text-white/60">
                The booking calendar isn’t connected yet. Set{' '}
                <code className="font-mono text-[0.85rem] text-echo-mint">
                  NEXT_PUBLIC_CALENDAR_URL
                </code>{' '}
                to your Calendly link and this page will embed it.
              </p>
              <p className="mt-4 text-[0.88rem] text-white/45">
                In the meantime, email{' '}
                <a className="text-echo-mint" href="mailto:hello@mindscalepartners.com">
                  hello@mindscalepartners.com
                </a>{' '}
                and we’ll find a time.
              </p>
            </div>
          </div>
        )}
      </div>
    </FunnelShell>
  );
}
