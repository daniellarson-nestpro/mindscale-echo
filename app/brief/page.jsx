import { Suspense } from 'react';
import FunnelShell from '../../components/funnel/FunnelShell';
import BriefForm from '../../components/funnel/BriefForm';
import { getSession } from '../../lib/auth';
import { getLeadByEmail, leadToBriefJson } from '../../lib/leads';

export const metadata = {
  title: 'Tell us about the business | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function initialFromBrief(brief) {
  if (!brief) return {};
  const sources = [];
  if (brief.articleUrl) {
    sources.push({
      type: 'url',
      value: brief.articleUrl,
      display: brief.articleUrl,
    });
  } else if (brief.articleText) {
    sources.push({
      type: 'text',
      value: brief.articleText,
      display: 'Article text',
      meta: `${brief.articleText.trim().split(/\s+/).length} words`,
    });
  }
  return { ...brief, sources };
}

export default async function BriefPage() {
  const session = getSession();
  let initial = {};
  if (session?.email) {
    try {
      const lead = await getLeadByEmail(session.email);
      initial = initialFromBrief(leadToBriefJson(lead).brief);
    } catch (err) {
      console.error('[brief] resume failed:', err?.message);
    }
  }

  return (
    <FunnelShell step={3} width="wide">
      <Suspense fallback={null}>
        <BriefForm initial={initial} />
      </Suspense>
    </FunnelShell>
  );
}
