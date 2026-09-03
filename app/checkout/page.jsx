import FunnelShell from '../../components/funnel/FunnelShell';
import CheckoutScreen from '../../components/funnel/CheckoutScreen';
import { DEMO_DRAFT } from '../../lib/draft';

export const metadata = {
  title: 'Send it out | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  // HOOK: load the signed-in user's brief so the purchase attaches to
  // something concrete rather than floating.
  const d = DEMO_DRAFT;
  const summary = [d.companyName, 'Second location', 'Draft ready'].join(' · ');

  return (
    <FunnelShell width="wide">
      <CheckoutScreen summary={summary} />
    </FunnelShell>
  );
}
