import { redirect } from 'next/navigation';
import FunnelShell from '../../components/funnel/FunnelShell';
import CheckoutScreen from '../../components/funnel/CheckoutScreen';
import { checkoutSummaryFromBrief } from '../../lib/draft';
import { getSession } from '../../lib/auth';
import { getApprovalForLead, getLeadForCheckout, leadToBriefJson } from '../../lib/leads';
import { hasN8nCompose } from '../../lib/compose';
import { checkoutGateFor } from '../../lib/funnel-gates';
import { looksLikeEmail, safePreviewToken } from '../../lib/url';

export const metadata = {
  title: 'Send it out | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }) {
  const session = getSession();
  const token = safePreviewToken(searchParams?.token);
  const email = looksLikeEmail(searchParams?.email) || looksLikeEmail(session?.email) || '';

  let lead = null;
  try {
    lead = await getLeadForCheckout({ email, token });
  } catch (err) {
    console.error('[checkout] lead resume failed:', err?.message);
  }

  const hasRealDraft = hasN8nCompose(lead);
  let alreadyApproved = false;
  if (lead && hasRealDraft) {
    try {
      alreadyApproved = Boolean(await getApprovalForLead(lead.id));
    } catch (err) {
      console.error('[checkout] approval lookup failed:', err?.message);
    }
  }
  const away = checkoutGateFor({ lead, hasRealDraft, alreadyApproved, token });
  if (away) redirect(away);

  const summary = checkoutSummaryFromBrief(leadToBriefJson(lead).brief);

  return (
    <FunnelShell width="wide">
      <CheckoutScreen summary={summary} token={token} email={email} />
    </FunnelShell>
  );
}
