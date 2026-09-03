import FunnelShell from '../../../components/funnel/FunnelShell';
import PreviewScreen from '../../../components/funnel/PreviewScreen';
import { DEMO_DRAFT } from '../../../lib/draft';
import { PLANS } from '../../../lib/plans';

export const metadata = {
  title: 'Your draft release | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function PreviewPage({ params }) {
  // HOOK: load draft_body + brief fields for params.token. DEMO_DRAFT stands
  // in until the composer is wired; the shape is identical.
  const draft = DEMO_DRAFT;

  return (
    <FunnelShell width="wide">
      <PreviewScreen draft={draft} token={params.token} price={PLANS.basic.priceLabel} />
    </FunnelShell>
  );
}
