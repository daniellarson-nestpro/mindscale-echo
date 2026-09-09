import { redirect } from 'next/navigation';
import FunnelShell from '../../../components/funnel/FunnelShell';
import { previewPagePathFor } from '../../../lib/funnel-gates';
import PreviewScreen from '../../../components/funnel/PreviewScreen';
import { PLANS } from '../../../lib/plans';
import { loadPreviewDraft } from '../../../lib/preview-draft';
import { getSession, normalizeEmail } from '../../../lib/auth';
import { getApprovalForLead, getLeadByEmail, getLeadById } from '../../../lib/leads';
import { hasN8nCompose } from '../../../lib/compose';
import { safePreviewToken } from '../../../lib/url';

export const metadata = {
  title: 'Your draft release | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

async function resolvePreviewLead(token, session) {
  const previewToken = safePreviewToken(token);
  if (previewToken !== 'demo') {
    try {
      const byId = await getLeadById(previewToken);
      if (byId) return byId;
    } catch (err) {
      console.error('[preview] lead load by id failed:', err?.message);
    }
  }
  if (session?.email) {
    try {
      return await getLeadByEmail(session.email);
    } catch (err) {
      console.error('[preview] lead load failed:', err?.message);
    }
  }
  return null;
}

export default async function PreviewPage({ params, searchParams }) {
  const session = getSession();
  const lead = await resolvePreviewLead(params?.token, session);
  const requiresApproval = hasN8nCompose(lead);
  const away = previewPagePathFor({
    token: safePreviewToken(params?.token),
    sessionEmail: session?.email || '',
    lead,
    hasRealDraft: requiresApproval,
  });
  if (away) redirect(away);
  const draft = await loadPreviewDraft(params?.token);
  const alreadyApproved = lead?.id
    ? Boolean(await getApprovalForLead(lead.id).catch(() => null))
    : false;
  const signedIn = Boolean(session?.email);
  const canApprove =
    signedIn &&
    Boolean(lead?.email) &&
    normalizeEmail(session.email) === normalizeEmail(lead.email);

  return (
    <FunnelShell width="wide">
      <PreviewScreen
        draft={draft}
        token={params.token}
        price={PLANS.basic.priceLabel}
        requiresApproval={requiresApproval}
        alreadyApproved={alreadyApproved}
        canApprove={canApprove}
        signedIn={signedIn}
        showApproveNotice={searchParams?.approve === '1'}
      />
    </FunnelShell>
  );
}
