import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Text Compare — Online Text Diff Tool',
  description:
    'Paste or type text into two editors and see differences highlighted in real time. Free online text diff tool with inline editing — no file needed, no upload, works in your browser.',
  keywords: ['text compare', 'text diff', 'compare text online', 'text difference checker', 'online text diff', 'paste and compare'],
  alternates: { canonical: 'https://compare.qz-l.com/text' },
  openGraph: {
    title: 'Text Compare — QZL Compare',
    description: 'Paste text into two editors and see real-time diff highlighting with character-level changes.',
    url: 'https://compare.qz-l.com/text',
  },
};

export default function TextCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
