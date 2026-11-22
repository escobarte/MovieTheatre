'use client';

import { usePathname } from 'next/navigation';

import { CardProvider } from './CardProvider';
import { CollectionProvider } from './CollectionProvider';
import { DisksProvider } from './DisksProvider';
import { Header, MobileSignOut } from './Header';
import { ListsProvider } from './ListsProvider';
import { SearchProvider } from './SearchProvider';

/**
 * Каркас сайта: провайдеры данных и шапка. На странице входа их нет — шапка
 * там не нужна, а провайдеры без сессии получили бы только 401.
 */
export function SiteShell({
  ownerEmail,
  children,
}: {
  ownerEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === '/vhod') return children;

  return (
    // Диски снаружи коллекции: коллекция сверяет diskId записей со списком дисков.
    <DisksProvider>
      <CollectionProvider>
        <ListsProvider>
          <CardProvider>
            <SearchProvider>
              <div className="mx-auto w-full max-w-[1280px] px-[18px]">
                <Header ownerEmail={ownerEmail} />
                {children}
                <MobileSignOut ownerEmail={ownerEmail} />
              </div>
            </SearchProvider>
          </CardProvider>
        </ListsProvider>
      </CollectionProvider>
    </DisksProvider>
  );
}
