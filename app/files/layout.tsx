import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'File Compare — Side-by-Side File Diff Tool',
  description:
    'Compare two files online side by side with line-by-line diff, character-level change highlights, and inline editing. Free file difference checker — no upload, no install.',
  keywords: ['file compare', 'file diff', 'compare two files', 'file difference checker', 'online file compare', 'side by side diff'],
  alternates: { canonical: 'https://compare.qz-l.com/files' },
  openGraph: {
    title: 'File Compare — QZL Compare',
    description: 'Compare two files side by side with diff highlighting, inline editing, and gutter copy buttons.',
    url: 'https://compare.qz-l.com/files',
  },
};

export default function FileCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
