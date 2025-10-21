import './globals.css';
import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import Providers from './providers';

const notoSans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Hi Trip",
  description: "Next.js app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSans.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#F7F9FC] font-[var(--font-noto-sans)] text-[#4A5568]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
