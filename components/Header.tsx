'use client';

import { ChartColumn, HardDrive, House, LayoutGrid, List, LogOut, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logout } from '@/app/actions';

import { useSearch } from './SearchProvider';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Главная', icon: House },
  { href: '/vse-kino', label: 'Всё кино', icon: LayoutGrid },
  { href: '/spiski', label: 'Списки', icon: List },
  { href: '/statistika', label: 'Статистика', icon: ChartColumn },
  { href: '/diski', label: 'Диски', icon: HardDrive },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

/**
 * Шапка. ≥600px — одна строка: логотип, ссылки, поиск, «Добавить», выход.
 * <600px — логотип, поиск и «Добавить» первой строкой, ряд из пяти разделов
 * всегда виден второй (6.7); выход на телефоне — внизу страницы, MobileSignOut.
 * ownerEmail есть только при настоящем входе — на preview и в dev выхода нет.
 */
export function Header({ ownerEmail }: { ownerEmail: string | null }) {
  const isActive = useIsActive();
  const { openSearch } = useSearch();

  const navLink = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
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
    <header className="flex flex-col pt-[18px] pb-[12px] min-[600px]:flex-row min-[600px]:flex-wrap min-[600px]:items-center min-[600px]:gap-6 min-[600px]:py-[18px]">
      {/* <600px — первая строка; на ПК обёртка исчезает (contents), логотип — обычный пункт строки. */}
      <div className="flex items-center justify-between gap-2 min-[600px]:contents">
        <Link href="/" className="text-[15px] font-bold tracking-[.1em] whitespace-nowrap">
          MOVIE<span className="text-red">_</span>THEATRE
        </Link>

        <div className="flex shrink-0 items-center gap-[4px] min-[600px]:hidden">
          <SearchButton
            onClick={() => openSearch('search')}
            className="flex h-[44px] w-[44px] items-center justify-center"
          />
          <AddButton onClick={() => openSearch('add')} />
        </div>
      </div>

      <nav className="hidden items-center gap-6 min-[600px]:flex">
        {NAV.map((item) => navLink(item.href, item.label))}
      </nav>

      <span className="hidden flex-1 min-[600px]:inline-block" />

      {/* ≥600px: поиск и «Добавить» в той же строке, как раньше (6.7). */}
      <div className="hidden items-center gap-6 min-[600px]:flex">
        <SearchButton onClick={() => openSearch('search')} />
        <AddButton onClick={() => openSearch('add')} />
        {ownerEmail && (
          <form action={logout}>
            <button
              type="submit"
              aria-label="Выйти"
              title={`Выйти · ${ownerEmail}`}
              className="flex h-[32px] w-[32px] items-center justify-center rounded-pill border border-line-strong text-text-2 transition-colors duration-[120ms] hover:text-text"
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </form>
        )}
      </div>

      {/* <600px — вторая строка, всегда на виду. -2px по бокам: панель в 16px от края экрана. */}
      <div className="mx-[-2px] mt-[10px] rounded-lg border border-line bg-surface p-[6px] min-[600px]:hidden">
        {/* Не minmax(0,1fr): «Статистика» 11px ≈ 69px, а равная пятая часть на 360px
            уже неё. Колонка не уже своей подписи, остальное делится поровну. */}
        <nav
          aria-label="Разделы"
          className="grid grid-cols-[repeat(5,minmax(max-content,1fr))] gap-[4px]"
        >
          {NAV.map((item) => (
            <NavTile key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </nav>
      </div>
    </header>
  );
}

/** Пункт ряда разделов на телефоне: иконка над подписью. Активный — красная иконка на розоватом фоне. */
function NavTile({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[56px] flex-col items-center justify-center gap-[6px] rounded-md px-[4px] transition-colors duration-[120ms] ${
        active ? 'bg-red/14 text-text' : 'text-text-2 hover:bg-surface-2 active:bg-surface-2'
      }`}
    >
      <Icon size={20} strokeWidth={1.5} className={active ? 'text-red' : undefined} />
      <span className="text-[11px] leading-[1.2] font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
}

/** Строка выхода в самом конце страницы — только на телефоне; на ПК выход в шапке. */
export function MobileSignOut({ ownerEmail }: { ownerEmail: string | null }) {
  if (!ownerEmail) return null;

  return (
    <div className="mt-[24px] flex items-center justify-between gap-3 border-t border-line min-[600px]:hidden">
      <span className="text-[12px] text-text-3">Вход: владелец</span>
      <form action={logout}>
        <button
          type="submit"
          title={ownerEmail}
          className="-mr-[6px] inline-flex min-h-[44px] items-center gap-[6px] px-[6px] text-[12.5px] text-text-2 transition-colors duration-[120ms] hover:text-text"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Выйти
        </button>
      </form>
    </div>
  );
}

function SearchButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Поиск"
      title="Поиск  /"
      className={`text-text-2 transition-colors duration-[120ms] hover:text-text ${className}`}
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
