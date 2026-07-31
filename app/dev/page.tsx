'use client';

import { useState } from 'react';

import type { Movie } from '@/lib/db/schema';

/**
 * Временная страница для ручной проверки парсинга на этапе 2.
 * Вёрстки здесь нет намеренно — экраны делаются на этапе 3, а эта
 * страница удаляется на этапе 7.
 */

type Candidate = {
  tmdbId: number;
  kind: 'movie' | 'tv';
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  director: string | null;
  added: boolean;
};

type LightMovie = Pick<Movie, 'id' | 'kind' | 'title' | 'year' | 'director' | 'ratingKp' | 'ratingImdb' | 'ratingTmdb'>;

export default function DevPage() {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saved, setSaved] = useState<Movie | null>(null);
  const [collection, setCollection] = useState<LightMovie[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setBusy('search');
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCandidates(data.results);
    } catch (e) {
      setError((e as Error).message);
      setCandidates([]);
    } finally {
      setBusy(null);
    }
  }

  async function add(candidate: Candidate) {
    setBusy(`add-${candidate.tmdbId}`);
    setError(null);
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tmdbId: candidate.tmdbId, kind: candidate.kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSaved(data.movie);
      setCandidates((prev) =>
        prev.map((c) => (c.tmdbId === candidate.tmdbId ? { ...c, added: true } : c)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function loadCollection() {
    setBusy('collection');
    setError(null);
    try {
      const res = await fetch('/api/movies');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCollection(data.movies);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-[820px] flex-col gap-6 p-6">
      <h1 className="text-[17px] font-bold">Проверка парсинга — этап 2</h1>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название"
          className="flex-1 rounded-md bg-surface px-3 py-2 caret-red outline-none"
        />
        <button
          type="submit"
          disabled={busy === 'search'}
          className="rounded-pill bg-red px-[18px] py-[9px] font-medium text-white disabled:opacity-50"
        >
          {busy === 'search' ? 'Ищу…' : 'Найти'}
        </button>
        <button
          type="button"
          onClick={loadCollection}
          className="rounded-pill bg-surface-3 px-[18px] py-[9px] font-medium"
        >
          Коллекция
        </button>
      </form>

      {error && <p className="rounded-sm bg-surface p-3 text-text-2">Ошибка: {error}</p>}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li key={`${c.kind}-${c.tmdbId}`} className="flex items-center gap-3 rounded-sm bg-surface p-2">
              {c.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.posterUrl} alt="" width={40} className="rounded-xs" />
              ) : (
                <div className="h-[60px] w-[40px] rounded-xs bg-surface-2" />
              )}
              <div className="flex-1">
                <div>
                  {c.title}{' '}
                  <span className="text-text-3">
                    · {c.kind === 'tv' ? 'сериал' : 'фильм'} · {c.year ?? '—'} · tmdb {c.tmdbId}
                  </span>
                </div>
                <div className="text-text-3">
                  {c.originalTitle ?? '—'} · реж. {c.director ?? '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => add(c)}
                disabled={c.added || busy === `add-${c.tmdbId}`}
                className="rounded-pill bg-red px-[18px] py-[9px] font-medium text-white disabled:bg-surface-3 disabled:text-text-3"
              >
                {c.added ? 'Есть' : busy === `add-${c.tmdbId}` ? 'Тяну…' : 'Добавить'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {saved && (
        <section>
          <h2 className="mb-2 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
            Записано в базу
          </h2>
          <pre className="overflow-x-auto rounded-sm bg-surface p-3 text-[11.5px] text-text-2">
            {JSON.stringify(saved, null, 2)}
          </pre>
        </section>
      )}

      {collection && (
        <section>
          <h2 className="mb-2 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
            Коллекция — {collection.length}
          </h2>
          <ul className="flex flex-col gap-1">
            {collection.map((m) => (
              <li key={m.id} className="text-text-2">
                {m.id}. {m.title} ({m.year ?? '—'}) · {m.kind} · {m.director ?? '—'} · КП{' '}
                {m.ratingKp ?? '—'} · IMDb {m.ratingImdb ?? '—'} · TMDB {m.ratingTmdb ?? '—'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
