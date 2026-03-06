import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'File Compare',
  description:
    'Compare two files side by side with line-by-line diff highlighting and inline character-level changes. Free, in-browser file difference checker.',
  alternates: { canonical: 'https://compare.qz-l.com/file-compare' },
};

export default function FileCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
