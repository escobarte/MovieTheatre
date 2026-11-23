'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { hasModifier, isTyping } from './layers';
import { SearchOverlay } from './SearchOverlay';
import { ADD_MORE, URL_PARAM, pushParam, replaceParam, useCloseParam, useUrlParam } from './url-state';

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

  // «Добавить ещё» из карточки (5.8): ждём, пока карточка уйдёт из адреса
  // (её закрытие может идти через history.back — это не мгновенно), затем
  // открываем добавление заново. Новый key пересоздаёт оверлей: поле пустое,
  // фокус в нём, прежняя выдача и поп-ап не остаются.
  const card = useUrlParam(URL_PARAM.card);
  const [addMore, setAddMore] = useState(false);
  const [fresh, setFresh] = useState(0);

  useEffect(() => {
    const onAddMore = () => setAddMore(true);
    window.addEventListener(ADD_MORE, onAddMore);
    return () => window.removeEventListener(ADD_MORE, onAddMore);
  }, []);

  useEffect(() => {
    if (!addMore || card !== null) return;
    setAddMore(false);
    setFresh((n) => n + 1);
    openSearch('add');
  }, [addMore, card, openSearch]);

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
      {mode && <SearchOverlay key={fresh} mode={mode} onClose={close} />}
    </SearchContext.Provider>
  );
}
