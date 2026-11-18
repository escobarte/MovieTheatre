'use client';

import { Menu, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useSearch } from './SearchProvider';

const NAV = [
  { href: '/', label: 'Главная' },
  { href: '/vse-kino', label: 'Всё кино' },
  { href: '/spiski', label: 'Списки' },
  { href: '/statistika', label: 'Статистика' },
  { href: '/diski', label: 'Диски' },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSearch } = useSearch();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMenuOpen(false)}
      aria-current={isActive(href) ? 'page' : undefined}
      // 6.4 относит активный пункт навигации к красному. В макете он белый —
      // при расхождении верен текст ТЗ.
      className={
        isActive(href)
          ? 'font-medium text-red'
          : 'text-text-2 transition-colors duration-[120ms] hover:text-text'
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="flex flex-col gap-3 border-b border-line py-[18px] min-[600px]:flex-row min-[600px]:flex-wrap min-[600px]:items-center min-[600px]:gap-6">
      <Link href="/" className="text-[15px] font-bold tracking-[.1em] whitespace-nowrap">
        MOVIE<span className="text-red">_</span>THEATRE
      </Link>

      <nav className="hidden items-center gap-6 min-[600px]:flex">
        {NAV.map((item) => navLink(item.href, item.label))}
      </nav>

      <span className="hidden flex-1 min-[600px]:inline-block" />

      {/* ≥600px: поиск и «Добавить» в той же строке, как раньше (6.7). */}
      <div className="hidden items-center gap-6 min-[600px]:flex">
        <SearchButton onClick={() => openSearch('search')} />
        <AddButton onClick={() => openSearch('add')} />
      </div>

      {/* <600px: вторая строка — меню и поиск слева, «Добавить» справа (6.7). */}
      <div className="flex items-center justify-between min-[600px]:hidden">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Закрыть меню' : 'Меню'}
            className="text-text-2 transition-colors duration-[120ms] hover:text-text"
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
          <SearchButton onClick={() => openSearch('search')} />
        </div>
        <AddButton onClick={() => openSearch('add')} />
      </div>

      {menuOpen && (
        <nav className="flex w-full flex-col gap-3 border-t border-line pt-4 min-[600px]:hidden">
          {NAV.map((item) => navLink(item.href, item.label))}
        </nav>
      )}
    </header>
  );
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Поиск"
      title="Поиск  /"
      className="text-text-2 transition-colors duration-[120ms] hover:text-text"
    >
      <Search size={17} strokeWidth={1.5} />
    </button>
  );
}

/** Тот же оверлей, но открытый сразу в режиме TMDB (5.8). */
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover"
    >
      <Plus size={15} strokeWidth={1.5} />
      Добавить
    </button>
  );
}
