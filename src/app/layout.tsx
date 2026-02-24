import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QZL Compare',
  description: 'Free browser-based file & folder comparison tool — no install needed.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#1e1e2e] text-[#cdd6f4] antialiased">
        {children}
      </body>
    </html>
  );
}
