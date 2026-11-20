'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { hasModifier, isTyping } from './layers';
import { SearchOverlay } from './SearchOverlay';

type Mode = 'search' | 'add';

type SearchState = { openSearch: (mode?: Mode) => void };

const SearchContext = createContext<SearchState>({ openSearch: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);

  const openSearch = useCallback((next: Mode = 'search') => setMode(next), []);

  // «/» открывает поиск на любом экране (5.5).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || hasModifier(event)) return;
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
