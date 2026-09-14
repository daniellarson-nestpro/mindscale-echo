import './globals.css';
import ScrollReveal from '../components/ScrollReveal';
import { META } from '../lib/content';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: META.title,
  description: META.description,
  openGraph: {
    title: META.ogTitle,
    description: META.ogDescription,
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
