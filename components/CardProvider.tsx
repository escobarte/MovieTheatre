'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { MovieCard } from './MovieCard';

/**
 * Одна карточка на всё приложение: её открывает любой постер — в сетке,
 * в карусели, в полке — и добавление сразу после записи в базу.
 *
 * sequence — id записей в том порядке, в каком они показаны там, откуда
 * открыли карточку (сетка с фильтрами и сортировкой, полка, список, диск).
 * По нему ← → листают соседей (5.11). Снимок берётся в момент открытия:
 * если запись выпала из фильтра после правки, листание не сбивается.
 */

type OpenOptions = { justAdded?: boolean; sequence?: number[] };
type CardState = { openCard: (id: number, options?: OpenOptions) => void };

const CardContext = createContext<CardState>({ openCard: () => {} });
const SequenceContext = createContext<number[] | undefined>(undefined);

export function useCard() {
  return useContext(CardContext);
}

/** Порядок для ← → у всех постеров внутри. */
export function CardSequence({ ids, children }: { ids: number[]; children: React.ReactNode }) {
  return <SequenceContext.Provider value={ids}>{children}</SequenceContext.Provider>;
}

export function useCardSequence() {
  return useContext(SequenceContext);
}

type Open = { id: number; justAdded: boolean; sequence: number[] };

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);

  const openCard = useCallback(
    (id: number, options?: OpenOptions) =>
      setOpen({ id, justAdded: options?.justAdded ?? false, sequence: options?.sequence ?? [] }),
    [],
  );

  const close = useCallback(() => setOpen(null), []);

  const index = open ? open.sequence.indexOf(open.id) : -1;
  const neighbour = (delta: -1 | 1) =>
    open && index !== -1 ? open.sequence[index + delta] : undefined;
  const prevId = neighbour(-1);
  const nextId = neighbour(1);

  const step = useCallback(
    (delta: -1 | 1) =>
      setOpen((current) => {
        if (!current) return current;
        const at = current.sequence.indexOf(current.id);
        const target = at === -1 ? undefined : current.sequence[at + delta];
        return target === undefined ? current : { ...current, id: target, justAdded: false };
      }),
    [],
  );

  const value = useMemo(() => ({ openCard }), [openCard]);

  return (
    <CardContext.Provider value={value}>
      {children}
      {open && (
        <MovieCard
          id={open.id}
          justAdded={open.justAdded}
          onClose={close}
          canStep={{ prev: prevId !== undefined, next: nextId !== undefined }}
          onStep={step}
        />
      )}
    </CardContext.Provider>
  );
}
