'use client';

import {
  ChartColumn,
  HardDrive,
  House,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { logout } from '@/app/actions';

import { useSearch } from './SearchProvider';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Главная', icon: House },
  { href: '/vse-kino', label: 'Всё кино', icon: LayoutGrid },
  { href: '/spiski', label: 'Списки', icon: List },
  { href: '/statistika', label: 'Статистика', icon: ChartColumn },
  { href: '/diski', label: 'Диски', icon: HardDrive },
];

/** ownerEmail есть только при настоящем входе — на preview и в dev выхода нет. */
export function Header({ ownerEmail }: { ownerEmail: string | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSearch } = useSearch();

  const menuPanel = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Меню на телефоне закрывается по Esc и по касанию вне панели. Кнопка ☰
  // считается «внутри»: иначе касание по ней закрыло бы меню и тут же открыло.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuPanel.current?.contains(target) || menuButton.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
    <header className="flex flex-col gap-3 py-[18px] min-[600px]:flex-row min-[600px]:flex-wrap min-[600px]:items-center min-[600px]:gap-6">
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

      {/* <600px: вторая строка — меню и поиск слева, «Добавить» справа (6.7). */}
      <div className="flex items-center justify-between min-[600px]:hidden">
        <div className="flex items-center gap-4">
          <button
            ref={menuButton}
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
        // -2px по бокам: отступ панели от края экрана 16px, а поле страницы — 18px.
        <div
          ref={menuPanel}
          className="mx-[-2px] rounded-lg border border-line bg-surface p-[10px] min-[600px]:hidden"
        >
          {/* Не minmax(0,1fr): «Статистика» 11px ≈ 69px, а равная пятая часть на 360px —
              58px, и даже 10.5px не влезает. Колонка не уже своей подписи, остальное делится поровну. */}
          <nav
            aria-label="Разделы"
            className="grid grid-cols-[repeat(5,minmax(max-content,1fr))] gap-[4px]"
          >
            {NAV.map((item) => (
              <MenuTile
                key={item.href}
                {...item}
                active={isActive(item.href)}
                onSelect={() => setMenuOpen(false)}
              />
            ))}
          </nav>

          {ownerEmail && (
            <div className="mt-[10px] flex items-center justify-between gap-3 border-t border-line pl-[6px]">
              <span className="text-[12px] text-text-3">Вход: владелец</span>
              <form action={logout}>
                <button
                  type="submit"
                  title={ownerEmail}
                  className="inline-flex min-h-[44px] items-center gap-[6px] px-[6px] text-[12.5px] text-text-2 transition-colors duration-[120ms] hover:text-text"
                >
                  <LogOut size={15} strokeWidth={1.5} />
                  Выйти
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/** Пункт мобильного меню: иконка над подписью. Активный — красная иконка на розоватом фоне. */
function MenuTile({
  href,
  label,
  icon: Icon,
  active,
  onSelect,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[68px] flex-col items-center justify-center gap-[6px] rounded-md px-[4px] transition-colors duration-[120ms] ${
        active ? 'bg-red/14 text-text' : 'text-text-2 hover:bg-surface-2 active:bg-surface-2'
      }`}
    >
      <Icon size={20} strokeWidth={1.5} className={active ? 'text-red' : undefined} />
      <span className="text-[11px] leading-[1.2] font-medium whitespace-nowrap">{label}</span>
    </Link>
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
