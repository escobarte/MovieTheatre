'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { SearchOverlay } from './SearchOverlay';

type Mode = 'search' | 'add';

type SearchState = { openSearch: (mode?: Mode) => void };

const SearchContext = createContext<SearchState>({ openSearch: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

/** Печатает ли пользователь прямо сейчас — тогда «/» это просто символ. */
function isTyping(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);

  const openSearch = useCallback((next: Mode = 'search') => setMode(next), []);

  // «/» открывает поиск на любом экране (5.5).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      event.preventDefault();
      setMode('search');
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Прокрутка страницы под оверлеем не нужна.
  useEffect(() => {
    if (!mode) return;

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mode]);

  const value = useMemo(() => ({ openSearch }), [openSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {mode && <SearchOverlay mode={mode} onClose={() => setMode(null)} />}
    </SearchContext.Provider>
  );
}
