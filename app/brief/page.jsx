import { Suspense } from 'react';
import FunnelShell from '../../components/funnel/FunnelShell';
import BriefForm from '../../components/funnel/BriefForm';
import { getSession } from '../../lib/auth';
import { initialFromBrief } from '../../lib/brief-shape';
import { getLeadByEmail, leadToBriefJson } from '../../lib/leads';

export const metadata = {
  title: 'Tell us about the business | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

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
