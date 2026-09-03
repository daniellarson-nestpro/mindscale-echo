import FunnelShell from '../../components/funnel/FunnelShell';
import CheckoutScreen from '../../components/funnel/CheckoutScreen';
import { checkoutSummaryFromBrief } from '../../lib/draft';
import { getSession } from '../../lib/auth';
import { getLeadByEmail, leadToBriefJson } from '../../lib/leads';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';

export const metadata = {
  title: 'Send it out | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }) {
  const session = getSession();
  let summary = 'Draft ready';
  if (session?.email) {
    try {
      const lead = await getLeadByEmail(session.email);
      summary = checkoutSummaryFromBrief(leadToBriefJson(lead).brief);
    } catch (err) {
      console.error('[checkout] lead resume failed:', err?.message);
    }
  }

  const token = safePreviewToken(searchParams?.token);
  const email = looksLikeEmail(searchParams?.email) || looksLikeEmail(session?.email) || '';

  return (
    <FunnelShell width="wide">
      <CheckoutScreen summary={summary} token={token} email={email} />
    </FunnelShell>
  );
}
