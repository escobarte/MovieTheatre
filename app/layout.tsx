import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';

import { CardProvider } from '@/components/CardProvider';
import { CollectionProvider } from '@/components/CollectionProvider';
import { DisksProvider } from '@/components/DisksProvider';
import { Header } from '@/components/Header';
import { ListsProvider } from '@/components/ListsProvider';

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
          <ListsProvider>
            <DisksProvider>
              <CardProvider>
                <div className="mx-auto w-full max-w-[1280px] px-[18px]">
                  <Header />
                  {children}
                </div>
              </CardProvider>
            </DisksProvider>
          </ListsProvider>
        </CollectionProvider>
      </body>
    </html>
  );
}
