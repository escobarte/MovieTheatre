'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { MovieCard } from './MovieCard';
import { URL_PARAM, pushParam, replaceParam, useCloseParam, useUrlParam } from './url-state';

/**
 * Одна карточка на всё приложение: её открывает любой постер — в сетке,
 * в карусели, в полке — и добавление сразу после записи в базу.
 *
 * Открытая карточка — это ?m=<id> в адресе (5.7): «Назад» её закрывает,
 * ссылка и обновление страницы открывают сразу. Остальное — порядок для
 * ← → и пометка «только что добавлено» — держится здесь, рядом с id.
 *
 * sequence — id записей в том порядке, в каком они показаны там, откуда
 * открыли карточку (сетка с фильтрами и сортировкой, полка, список, диск).
 * Снимок берётся в момент открытия: если запись выпала из фильтра после
 * правки, листание не сбивается. Открытая по ссылке карточка не листается.
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

type Meta = { openedId: number; justAdded: boolean; sequence: number[] };

export function CardProvider({ children }: { children: React.ReactNode }) {
  const param = useUrlParam(URL_PARAM.card);
  const id = param !== null && /^\d+$/.test(param) ? Number(param) : null;
  const [meta, setMeta] = useState<Meta | null>(null);

  const openCard = useCallback((next: number, options?: OpenOptions) => {
    setMeta({
      openedId: next,
      justAdded: options?.justAdded ?? false,
      sequence: options?.sequence ?? [],
    });
    const alreadyOpen = new URLSearchParams(window.location.search).has(URL_PARAM.card);
    if (alreadyOpen) replaceParam(URL_PARAM.card, String(next));
    else pushParam(URL_PARAM.card, String(next), 'mtCard');
  }, []);

  const close = useCloseParam(URL_PARAM.card, 'mtCard', param);

  // Порядок действует, только если открытая запись в нём есть (по ссылке — нет).
  const sequence = id !== null && meta?.sequence.includes(id) ? meta.sequence : [];
  const index = id === null ? -1 : sequence.indexOf(id);
  const prevId = index > 0 ? sequence[index - 1] : undefined;
  const nextId = index !== -1 && index < sequence.length - 1 ? sequence[index + 1] : undefined;

  // ← → не плодят историю: тот же шаг, другой id.
  const step = useCallback(
    (delta: -1 | 1) => {
      const target = delta === -1 ? prevId : nextId;
      if (target !== undefined) replaceParam(URL_PARAM.card, String(target));
    },
    [prevId, nextId],
  );

  const value = useMemo(() => ({ openCard }), [openCard]);

  return (
    <CardContext.Provider value={value}>
      {children}
      {id !== null && (
        <MovieCard
          id={id}
          justAdded={meta?.openedId === id && meta.justAdded}
          onClose={close}
          canStep={{ prev: prevId !== undefined, next: nextId !== undefined }}
          onStep={step}
        />
      )}
    </CardContext.Provider>
  );
}
