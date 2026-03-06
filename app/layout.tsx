import type { Metadata, Viewport } from 'next';
import './globals.css';

const BASE_URL = 'https://compare.qz-l.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'QZL Compare — Free Online File, Folder & Text Diff Tool',
    template: '%s | QZL Compare',
  },
  description:
    'Compare files, folders, and text online for free. Instant side-by-side diff with line-level highlighting — no install, no upload, all processing in your browser.',
  keywords: [
    'compare files online',
    'compare folders online',
    'text diff tool',
    'file difference checker',
    'online diff tool',
    'folder comparison',
    'file compare',
    'text compare',
    'diff checker',
    'free diff tool',
  ],
  authors: [{ name: 'QZL Compare', url: BASE_URL }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'QZL Compare — Free Online File, Folder & Text Diff Tool',
    description:
      'Compare files, folders, and text online for free. Instant side-by-side diff with line-level highlighting — no install, no upload.',
    siteName: 'QZL Compare',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QZL Compare — online file & folder diff tool',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QZL Compare — Free Online File, Folder & Text Diff Tool',
    description:
      'Compare files, folders, and text online for free. Instant side-by-side diff, no install required.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      // favicon.ico is auto-detected from src/app/favicon.ico (fallback for old browsers)
      { url: '/icon.svg', type: 'image/svg+xml' },       // modern browsers prefer SVG
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Online File & Folder Compare Tool',
  description: 'Compare folders, files, and text online instantly',
  url: BASE_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a modern web browser with JavaScript enabled',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Compare two folders side by side',
    'File line-by-line diff with syntax highlighting',
    'Real-time text comparison',
    'All processing in browser — no file upload required',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="h-full bg-[#12161c] text-[#e5e7eb] antialiased selection:bg-[#cc3333] selection:text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
