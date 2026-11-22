'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { decode, type Entry, type LightRow } from '@/lib/collection';

import { useDisks } from './DisksProvider';

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
  /** Убрать запись из памяти после удаления в базе. */
  removeEntry: (id: number) => void;
  reload: () => Promise<void>;
};

const CollectionContext = createContext<CollectionState>({
  entries: [],
  loading: true,
  error: null,
  applyPatch: () => {},
  removeEntry: () => {},
  reload: async () => {},
});

export function useCollection() {
  return useContext(CollectionContext);
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<LightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { disks, loading: disksLoading, error: disksError } = useDisks();

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

  const removeEntry = useCallback((id: number) => {
    setRows((prev) => prev?.filter((row) => row.id !== id) ?? prev);
  }, []);

  // Запись с diskId, которого нет среди дисков («сирота» после удаления диска),
  // считается записью без диска. Пока диски не загрузились или загрузка
  // упала, ничего не трогаем: пустой список не должен «осиротить» всё. В базу
  // это не пишется.
  const diskIds = useMemo(
    () => (disksLoading || disksError ? null : new Set(disks.map((disk) => disk.id))),
    [disks, disksLoading, disksError],
  );

  const value = useMemo<CollectionState>(
    () => ({
      entries: (rows ?? []).map((row) =>
        decode(diskIds && row.diskId !== null && !diskIds.has(row.diskId) ? { ...row, diskId: null } : row),
      ),
      loading: rows === null && error === null,
      error,
      applyPatch,
      removeEntry,
      reload,
    }),
    [rows, error, diskIds, applyPatch, removeEntry, reload],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
