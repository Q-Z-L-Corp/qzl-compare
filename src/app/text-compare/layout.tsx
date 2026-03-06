import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Text Compare',
  description:
    'Paste or type text into two editors and see differences highlighted in real-time. Free online text diff tool — no file system access required.',
  alternates: { canonical: 'https://compare.qz-l.com/text-compare' },
};

export default function TextCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
