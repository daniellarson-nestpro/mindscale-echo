import './globals.css';
import ScrollReveal from '../components/ScrollReveal';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Mindscale Echo — AI-Powered Media Distribution for the Human and AI Layers',
  description:
    'Turn local coverage into a professionally written press release, distributed across major media channels and, on Premium, AI discovery channels.',
  openGraph: {
    title: 'Mindscale Echo',
    description: 'AI-powered media distribution for the human and AI layers.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#050506',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <div className="grain" aria-hidden="true" />
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
