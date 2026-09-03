import { Suspense } from 'react';
import FunnelShell from '../../../components/funnel/FunnelShell';
import VerifyForm from '../../../components/funnel/VerifyForm';

export const metadata = {
  title: 'Check your email | Mindscale Echo',
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <FunnelShell step={2}>
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </FunnelShell>
  );
}
