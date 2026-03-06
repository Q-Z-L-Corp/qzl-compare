import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Folder Compare',
  description:
    'Compare two folders online and instantly see which files are different, added, or removed. Free browser-based directory comparison tool.',
  alternates: { canonical: 'https://compare.qz-l.com/folders' },
};

export default function FolderCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
