'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { MovieCard } from './MovieCard';

/**
 * Одна карточка на всё приложение: её открывает любой постер — в сетке,
 * в карусели, в полке — и добавление сразу после записи в базу.
 */

type CardState = { openCard: (id: number, options?: { justAdded?: boolean }) => void };

const CardContext = createContext<CardState>({ openCard: () => {} });

export function useCard() {
  return useContext(CardContext);
}

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<{ id: number; justAdded: boolean } | null>(null);

  const openCard = useCallback(
    (id: number, options?: { justAdded?: boolean }) =>
      setOpen({ id, justAdded: options?.justAdded ?? false }),
    [],
  );

  const value = useMemo(() => ({ openCard }), [openCard]);

  return (
    <CardContext.Provider value={value}>
      {children}
      {open && (
        <MovieCard id={open.id} justAdded={open.justAdded} onClose={() => setOpen(null)} />
      )}
    </CardContext.Provider>
  );
}
