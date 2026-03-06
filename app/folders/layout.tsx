import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Folder Compare — Directory Comparison Tool',
  description:
    'Compare two folders online and instantly see which files are different, added, or removed. Free browser-based directory comparison tool — recursive, no install, files never uploaded.',
  keywords: ['folder compare', 'directory compare', 'compare folders online', 'folder diff', 'directory difference checker', 'compare directories'],
  alternates: { canonical: 'https://compare.qz-l.com/folders' },
  openGraph: {
    title: 'Folder Compare — QZL Compare',
    description: 'Compare two folder structures online. Instantly detect added, removed, and modified files across directories.',
    url: 'https://compare.qz-l.com/folders',
  },
};

export default function FolderCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
