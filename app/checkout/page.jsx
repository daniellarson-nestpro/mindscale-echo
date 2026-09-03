import FunnelShell from '../../components/funnel/FunnelShell';
import CheckoutScreen from '../../components/funnel/CheckoutScreen';
import { DEMO_DRAFT } from '../../lib/draft';
import { getSession } from '../../lib/auth';
import { getLeadByEmail } from '../../lib/leads';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';

export const metadata = {
  title: 'Send it out | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }) {
  // HOOK: composer still has no draft_body — DEMO_DRAFT stands in for the
  // plate/preview. The purchase attaches to the signed-in lead when present.
  const session = getSession();
  let summary = [DEMO_DRAFT.companyName, 'Second location', 'Draft ready'].join(' · ');
  if (session?.email) {
    try {
      const lead = await getLeadByEmail(session.email);
      if (lead?.company_name) {
        summary = [lead.company_name, lead.announcement_type || 'Draft ready']
          .filter(Boolean)
          .join(' · ');
      }
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
