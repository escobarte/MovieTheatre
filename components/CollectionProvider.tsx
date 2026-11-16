'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { decode, type Entry, type LightRow } from '@/lib/collection';

/**
 * Облегчённая коллекция забирается один раз за сессию (5.4). Дальше сервер
 * в фильтрации не участвует — всё считается в памяти. Правки из карточки
 * применяются к этому же массиву, чтобы сетка и полки обновлялись без
 * повторной загрузки.
 */

type CollectionState = {
  entries: Entry[];
  loading: boolean;
  error: string | null;
  /** Обновить запись в памяти после сохранения в карточке. */
  applyPatch: (id: number, fields: Partial<LightRow>) => void;
  reload: () => Promise<void>;
};

const CollectionContext = createContext<CollectionState>({
  entries: [],
  loading: true,
  error: null,
  applyPatch: () => {},
  reload: async () => {},
});

export function useCollection() {
  return useContext(CollectionContext);
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<LightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/movies');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setRows(data.movies as LightRow[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyPatch = useCallback((id: number, fields: Partial<LightRow>) => {
    setRows((prev) => prev?.map((row) => (row.id === id ? { ...row, ...fields } : row)) ?? prev);
  }, []);

  const value = useMemo<CollectionState>(
    () => ({
      entries: (rows ?? []).map(decode),
      loading: rows === null && error === null,
      error,
      applyPatch,
      reload,
    }),
    [rows, error, applyPatch, reload],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
