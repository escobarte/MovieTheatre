'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { decode, type Entry, type LightRow } from '@/lib/collection';

/**
 * Облегчённая коллекция забирается один раз за сессию (5.4). Дальше сервер
 * в фильтрации не участвует — всё считается в памяти.
 */

type CollectionState = {
  entries: Entry[];
  loading: boolean;
  error: string | null;
};

const CollectionContext = createContext<CollectionState>({
  entries: [],
  loading: true,
  error: null,
});

export function useCollection() {
  return useContext(CollectionContext);
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<LightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/movies')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        return data.movies as LightRow[];
      })
      .then((movies) => {
        if (!cancelled) setRows(movies);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CollectionState>(
    () => ({
      entries: (rows ?? []).map(decode),
      loading: rows === null && error === null,
      error,
    }),
    [rows, error],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
