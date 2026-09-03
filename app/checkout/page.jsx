import FunnelShell from '../../components/funnel/FunnelShell';
import CheckoutScreen from '../../components/funnel/CheckoutScreen';
import { DEMO_DRAFT } from '../../lib/draft';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';

export const metadata = {
  title: 'Send it out | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function CheckoutPage({ searchParams }) {
  // HOOK: load the signed-in user's brief so the purchase attaches to
  // something concrete rather than floating. DEMO_DRAFT stands in — PATCH
  // /api/brief is still a console.log on this branch.
  const d = DEMO_DRAFT;
  const summary = [d.companyName, 'Second location', 'Draft ready'].join(' · ');
  const token = safePreviewToken(searchParams?.token);
  const email = looksLikeEmail(searchParams?.email) || '';

  return (
    <FunnelShell width="wide">
      <CheckoutScreen summary={summary} token={token} email={email} />
    </FunnelShell>
  );
}
