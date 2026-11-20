import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';

import { auth, authBypassed } from '@/auth';
import { FocusRing } from '@/components/FocusRing';
import { SiteShell } from '@/components/SiteShell';

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
  // Next 15 по capable: true пишет только mobile-web-app-capable;
  // старый apple-тег для установки на iOS добавлен руками.
  appleWebApp: { capable: true, title: 'Movie_Theatre' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#121217',
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // На preview и в development входа нет — и кнопки выхода тоже.
  const session = authBypassed() ? null : await auth();

  return (
    <html lang="ru" className={onest.variable}>
      <body>
        <FocusRing />
        <SiteShell ownerEmail={session?.user?.email ?? null}>{children}</SiteShell>
      </body>
    </html>
  );
}
