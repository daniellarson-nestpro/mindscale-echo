import FunnelShell from '../../../components/funnel/FunnelShell';
import PreviewScreen from '../../../components/funnel/PreviewScreen';
import { PLANS } from '../../../lib/plans';
import { loadPreviewDraft } from '../../../lib/preview-draft';

export const metadata = {
  title: 'Your draft release | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }) {
  // HOOK: when GET /api/brief has a draft_body, prefer that. Until then
  // draftFromBrief maps the lead. Do not call n8n.
  const draft = await loadPreviewDraft(params?.token);

  return (
    <FunnelShell width="wide">
      <PreviewScreen draft={draft} token={params.token} price={PLANS.basic.priceLabel} />
    </FunnelShell>
  );
}
