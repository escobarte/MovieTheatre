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
    <header className="flex flex-wrap items-center gap-6 py-[18px]">
      <Link href="/" className="text-[15px] font-bold tracking-[.1em] whitespace-nowrap">
        MOVIE<span className="text-red">_</span>THEATRE
      </Link>

      <nav className="hidden items-center gap-6 sm:flex">
        {NAV.map((item) => navLink(item.href, item.label))}
      </nav>

      <span className="flex-1" />

      {/* На телефоне пункты сворачиваются в кнопку меню, поиск и «Добавить» остаются (6.7). */}
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Закрыть меню' : 'Меню'}
        className="text-text-2 transition-colors duration-[120ms] hover:text-text sm:hidden"
      >
        {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
      </button>

      <button
        type="button"
        onClick={() => openSearch('search')}
        aria-label="Поиск"
        title="Поиск  /"
        className="text-text-2 transition-colors duration-[120ms] hover:text-text"
      >
        <Search size={17} strokeWidth={1.5} />
      </button>

      {/* Тот же оверлей, но открытый сразу в режиме TMDB (5.8). */}
      <button
        type="button"
        onClick={() => openSearch('add')}
        className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover"
      >
        <Plus size={15} strokeWidth={1.5} />
        Добавить
      </button>

      {menuOpen && (
        <nav className="flex w-full flex-col gap-3 border-t border-line pt-4 sm:hidden">
          {NAV.map((item) => navLink(item.href, item.label))}
        </nav>
      )}
    </header>
  );
}
