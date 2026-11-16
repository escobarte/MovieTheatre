'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Диск вместе со сводкой, посчитанной на сервере. */
export type Disk = {
  id: number;
  label: string;
  sizeGb: number;
  note: string | null;
  createdAt: string;
  usedGb: number;
  freeGb: number;
  movies: number;
  moviesWithoutSize: number;
};

type DisksState = {
  disks: Disk[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createDisk: (label: string, sizeGb: number) => Promise<Disk | null>;
  patchDisk: (id: number, fields: Partial<Disk>) => Promise<void>;
  deleteDisk: (id: number) => Promise<void>;
};

const DisksContext = createContext<DisksState>({
  disks: [],
  loading: true,
  error: null,
  reload: async () => {},
  createDisk: async () => null,
  patchDisk: async () => {},
  deleteDisk: async () => {},
});

export function useDisks() {
  return useContext(DisksContext);
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

/**
 * Диски держатся в памяти рядом с коллекцией: из них берутся подписи для
 * фильтра «диск» и выбор в карточке. Сводка по занятому месту приходит с
 * сервера, поэтому после правки веса фильма список перезапрашивается.
 */
export function DisksProvider({ children }: { children: React.ReactNode }) {
  const [disks, setDisks] = useState<Disk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await json<{ disks: Disk[] }>('/api/disks');
      setDisks(data.disks);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setDisks([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createDisk = useCallback(
    async (label: string, sizeGb: number) => {
      try {
        const { disk } = await json<{ disk: Disk }>('/api/disks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, sizeGb }),
        });
        setDisks((prev) => [...(prev ?? []), disk].sort((a, b) => a.label.localeCompare(b.label, 'ru')));
        setError(null);
        return disk;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [],
  );

  const patchDisk = useCallback(
    async (id: number, fields: Partial<Disk>) => {
      try {
        await json(`/api/disks/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fields),
        });
        await reload();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [reload],
  );

  const deleteDisk = useCallback(
    async (id: number) => {
      try {
        setDisks((prev) => prev?.filter((disk) => disk.id !== id) ?? prev);
        await json(`/api/disks/${id}`, { method: 'DELETE' });
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        await reload();
      }
    },
    [reload],
  );

  const value = useMemo<DisksState>(
    () => ({
      disks: disks ?? [],
      loading: disks === null,
      error,
      reload,
      createDisk,
      patchDisk,
      deleteDisk,
    }),
    [disks, error, reload, createDisk, patchDisk, deleteDisk],
  );

  return <DisksContext.Provider value={value}>{children}</DisksContext.Provider>;
}
