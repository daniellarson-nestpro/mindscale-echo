import { Suspense } from 'react';
import FunnelShell from '../../components/funnel/FunnelShell';
import BriefForm from '../../components/funnel/BriefForm';

export const metadata = {
  title: 'Tell us about the business | Mindscale Echo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function BriefPage() {
  // HOOK: hydrate `initial` from the saved brief once the backend exposes it,
  // so a returning owner resumes instead of starting over.
  return (
    <FunnelShell step={3} width="wide">
      <Suspense fallback={null}>
        <BriefForm initial={{}} />
      </Suspense>
    </FunnelShell>
  );
}
