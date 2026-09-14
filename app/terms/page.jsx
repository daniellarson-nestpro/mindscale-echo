import LegalShell from '../../components/LegalShell';
import { TERMS_MD } from '../../content/legal/terms';

export const metadata = {
  title: 'Terms of Service — Mindscale Echo',
  description:
    'The terms that govern purchase and use of Mindscale Echo press release writing and distribution.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalShell eyebrow="Legal" current="terms" markdown={TERMS_MD} />;
}
