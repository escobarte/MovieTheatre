'use client';

import { useCallback, useEffect, useState } from 'react';

import { FILE_STATUS_LABELS, STATUS_LABELS, type LightRow } from '@/lib/collection';
import type { FileStatus, Movie, Status } from '@/lib/db/schema';

/**
 * Временная служебная страница: поиск в TMDB, добавление и правка личных
 * полей. Вёрстки здесь нет намеренно — экраны делаются отдельно, а сама
 * страница удаляется вместе с появлением карточки записи и авторизации.
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

export default function DevPage() {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saved, setSaved] = useState<Movie | null>(null);
  const [collection, setCollection] = useState<LightRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCollection = useCallback(async () => {
    try {
      const res = await fetch('/api/movies');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCollection(data.movies);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

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
      await loadCollection();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: number, fields: Partial<LightRow>) {
    setCollection((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
    setError(null);
    try {
      const res = await fetch(`/api/movies/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
    } catch (e) {
      setError((e as Error).message);
      await loadCollection();
    }
  }

  return (
    <main className="flex flex-col gap-6 pb-16">
      <h1 className="text-[17px] font-bold">Служебная страница</h1>

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
      </form>

      {error && <p className="rounded-sm bg-surface p-3 text-text-2">Ошибка: {error}</p>}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li
              key={`${c.kind}-${c.tmdbId}`}
              className="flex items-center gap-3 rounded-sm bg-surface p-2"
            >
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

      <section>
        <h2 className="mb-2 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
          Коллекция — {collection.length}. Личные поля правятся здесь, пока нет карточки
        </h2>

        <ul className="flex flex-col gap-2">
          {collection.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-sm bg-surface p-2">
              <span className="min-w-[220px] flex-1">
                {m.title}{' '}
                <span className="text-text-3">
                  {m.year ?? '—'} · {m.kind === 'tv' ? 'сериал' : 'фильм'}
                </span>
              </span>

              <Select
                value={m.status}
                onChange={(status) => patch(m.id, { status: status as Status })}
                options={Object.entries(STATUS_LABELS)}
              />

              <Select
                value={String(m.rating ?? '')}
                onChange={(v) => patch(m.id, { rating: v ? Number(v) : null })}
                options={[
                  ['', 'оценка —'],
                  ...Array.from({ length: 10 }, (_, i) => [String(i + 1), `оценка ${i + 1}`] as [string, string]),
                ]}
              />

              <Select
                value={m.fileStatus}
                onChange={(v) => patch(m.id, { fileStatus: v as FileStatus })}
                options={Object.entries(FILE_STATUS_LABELS).map(([k, label]) => [k, `файл: ${label}`])}
              />

              <Toggle
                label="пересмотреть"
                on={m.rewatch === 1}
                onChange={(on) => patch(m.id, { rewatch: on ? 1 : 0 })}
              />

              <Toggle
                label="избранное"
                on={m.favorite === 1}
                onChange={(on) => patch(m.id, { favorite: on ? 1 : 0 })}
              />

              {m.kind === 'tv' && (
                <span className="flex items-center gap-1 text-text-3">
                  S
                  <NumBox
                    value={m.progressSeason}
                    onChange={(v) => patch(m.id, { progressSeason: v })}
                  />
                  E
                  <NumBox
                    value={m.progressEpisode}
                    onChange={(v) => patch(m.id, { progressEpisode: v })}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px]"
    >
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`rounded-pill px-[14px] py-[7px] text-[12px] ${
        on ? 'bg-red font-medium text-white' : 'bg-surface-3 text-text-2'
      }`}
    >
      {label}
    </button>
  );
}

function NumBox({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-[52px] rounded-xs bg-surface-3 px-2 py-1 text-[12px] text-text caret-red outline-none"
    />
  );
}
