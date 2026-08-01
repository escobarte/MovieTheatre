'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ListItem = { movieId: number; position: number; note: string | null };

export type MovieList = {
  id: number;
  title: string;
  description: string | null;
  coverMovieId: number | null;
  position: number | null;
  createdAt: string;
  items: ListItem[];
};

export type SavedView = { id: number; title: string; query: string; position: number | null };

type ListsState = {
  lists: MovieList[];
  views: SavedView[];
  loading: boolean;
  error: string | null;
  createList: (title: string) => Promise<MovieList | null>;
  patchList: (id: number, fields: Partial<MovieList>) => Promise<void>;
  deleteList: (id: number) => Promise<void>;
  putItems: (id: number, items: ListItem[]) => Promise<void>;
  addToList: (id: number, movieId: number) => Promise<void>;
  createView: (title: string, query: string) => Promise<void>;
  deleteView: (id: number) => Promise<void>;
};

const noop = async () => {};

const ListsContext = createContext<ListsState>({
  lists: [],
  views: [],
  loading: true,
  error: null,
  createList: async () => null,
  patchList: noop,
  deleteList: noop,
  putItems: noop,
  addToList: noop,
  createView: noop,
  deleteView: noop,
});

export function useLists() {
  return useContext(ListsContext);
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

/**
 * Подборки и сохранённые фильтры грузятся один раз и живут в памяти рядом
 * с коллекцией: из них строится полка на Главной, экран «Списки» и категория
 * фильтра «список».
 */
export function ListsProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<MovieList[] | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        json<{ lists: MovieList[] }>('/api/lists'),
        json<{ views: SavedView[] }>('/api/views'),
      ]);
      setLists(a.lists);
      setViews(b.views);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setLists([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guard = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const createList = useCallback(async (title: string) => {
    try {
      const { list } = await json<{ list: MovieList }>('/api/lists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      setLists((prev) => [...(prev ?? []), list]);
      setError(null);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const patchList = useCallback(
    (id: number, fields: Partial<MovieList>) =>
      guard(async () => {
        setLists((prev) => prev?.map((l) => (l.id === id ? { ...l, ...fields } : l)) ?? prev);
        await json(`/api/lists/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fields),
        });
      }),
    [guard],
  );

  const deleteList = useCallback(
    (id: number) =>
      guard(async () => {
        setLists((prev) => prev?.filter((l) => l.id !== id) ?? prev);
        await json(`/api/lists/${id}`, { method: 'DELETE' });
      }),
    [guard],
  );

  const putItems = useCallback(
    (id: number, items: ListItem[]) =>
      guard(async () => {
        const ordered = items.map((item, index) => ({ ...item, position: index }));
        setLists((prev) => prev?.map((l) => (l.id === id ? { ...l, items: ordered } : l)) ?? prev);
        await json(`/api/lists/${id}/items`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: ordered }),
        });
      }),
    [guard],
  );

  const addToList = useCallback(
    async (id: number, movieId: number) => {
      const list = lists?.find((l) => l.id === id);
      if (!list || list.items.some((item) => item.movieId === movieId)) return;

      await putItems(id, [...list.items, { movieId, position: list.items.length, note: null }]);
    },
    [lists, putItems],
  );

  const createView = useCallback(
    (title: string, query: string) =>
      guard(async () => {
        const { view } = await json<{ view: SavedView }>('/api/views', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, query }),
        });
        setViews((prev) => [...prev, view]);
      }),
    [guard],
  );

  const deleteView = useCallback(
    (id: number) =>
      guard(async () => {
        setViews((prev) => prev.filter((v) => v.id !== id));
        await json(`/api/views?id=${id}`, { method: 'DELETE' });
      }),
    [guard],
  );

  const value = useMemo<ListsState>(
    () => ({
      lists: lists ?? [],
      views,
      loading: lists === null,
      error,
      createList,
      patchList,
      deleteList,
      putItems,
      addToList,
      createView,
      deleteView,
    }),
    [lists, views, error, createList, patchList, deleteList, putItems, addToList, createView, deleteView],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}
