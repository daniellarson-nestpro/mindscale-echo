import { Suspense } from 'react';
import FunnelShell from '../../components/funnel/FunnelShell';
import StartFlow from '../../components/funnel/StartFlow';

export const metadata = {
  title: 'Start your release | Mindscale Echo',
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return (
    <FunnelShell step={1}>
      <Suspense fallback={null}>
        <StartFlow />
      </Suspense>
    </FunnelShell>
  );
}
