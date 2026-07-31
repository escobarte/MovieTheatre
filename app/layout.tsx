import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';

import { CollectionProvider } from '@/components/CollectionProvider';
import { Header } from '@/components/Header';

import './globals.css';

const onest = Onest({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-onest',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MOVIE_THEATRE',
  description: 'Персональный каталог фильмов и сериалов',
};

export const viewport: Viewport = {
  themeColor: '#0B0B0D',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={onest.variable}>
      <body>
        <CollectionProvider>
          <div className="mx-auto w-full max-w-[1280px] px-[18px]">
            <Header />
            {children}
          </div>
        </CollectionProvider>
      </body>
    </html>
  );
}
