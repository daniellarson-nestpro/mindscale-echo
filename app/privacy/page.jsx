import LegalShell from '../../components/LegalShell';
import { PRIVACY_MD } from '../../content/legal/privacy';

export const metadata = {
  title: 'Privacy Policy — Mindscale Echo',
  description:
    'What Mindscale Echo collects, how it is used, who it is shared with, and the choices you have.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalShell eyebrow="Legal" current="privacy" markdown={PRIVACY_MD} />;
}
