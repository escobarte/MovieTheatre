'use client';

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { hasModifier, isTyping } from './layers';
import { SearchOverlay } from './SearchOverlay';
import { URL_PARAM, pushParam, replaceParam, useCloseParam, useUrlParam } from './url-state';

type Mode = 'search' | 'add';

type SearchState = { openSearch: (mode?: Mode) => void };

const SearchContext = createContext<SearchState>({ openSearch: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

const FLAG: Record<Mode, string> = { search: '1', add: 'add' };

/**
 * Открытый поиск — это ?search=1 (или add) в адресе: открытие кладёт шаг
 * в историю, «Назад» закрывает оверлей (5.7). Карточка, открытая из поиска,
 * ложится следующим шагом поверх — «Назад» из неё возвращает в поиск.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const param = useUrlParam(URL_PARAM.search);
  const mode: Mode | null = param === 'add' ? 'add' : param === null ? null : 'search';

  const openSearch = useCallback((next: Mode = 'search') => {
    const open = new URLSearchParams(window.location.search).has(URL_PARAM.search);
    if (open) replaceParam(URL_PARAM.search, FLAG[next]);
    else pushParam(URL_PARAM.search, FLAG[next], 'mtSearch');
  }, []);

  const close = useCloseParam(URL_PARAM.search, 'mtSearch', param);

  // «/» открывает поиск на любом экране (5.5).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || hasModifier(event)) return;
      if (isTyping(event.target)) return;

      event.preventDefault();
      openSearch('search');
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSearch]);

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
      {mode && <SearchOverlay mode={mode} onClose={close} />}
    </SearchContext.Provider>
  );
}
