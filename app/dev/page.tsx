'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useCard } from '@/components/CardProvider';
import { useCollection } from '@/components/CollectionProvider';
import { Poster } from '@/components/Poster';

/**
 * Временная страница добавления: поиск по TMDB и кнопка «Добавить».
 * Сразу после записи открывается карточка — чтобы не уходя выставить статус
 * и оценку. Правка полей живёт там же, отдельных переключателей здесь нет.
 * Страница уезжает вместе с оверлеем поиска на этапе 6.
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
  const { entries, reload } = useCollection();
  const { openCard } = useCard();

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;

    setBusy('search');
    setError(null);
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

      setCandidates((prev) =>
        prev.map((c) => (c.tmdbId === candidate.tmdbId ? { ...c, added: true } : c)),
      );
      await reload();
      openCard(data.movie.id, { justAdded: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <h1 className="text-[22px] font-bold">Добавить</h1>

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
          className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-50"
        >
          {busy === 'search' ? 'Ищу…' : 'Найти'}
        </button>
      </form>

      {error && <p className="rounded-sm bg-surface p-3 text-text-2">Ошибка: {error}</p>}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-1">
          {candidates.map((c) => (
            <li
              key={`${c.kind}-${c.tmdbId}`}
              className="flex items-center gap-[14px] rounded-sm bg-surface p-[11px_12px]"
            >
              <span className="flex h-[57px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-xs bg-surface-2">
                {c.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.posterUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{c.title}</span>
                <span className="mt-[3px] block text-[12px] text-text-3">
                  {[c.year, c.kind === 'tv' ? 'сериал' : c.originalTitle, c.director]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>

              {c.added ? (
                <span className="text-[12.5px] text-text-3">в коллекции</span>
              ) : (
                <button
                  type="button"
                  onClick={() => add(c)}
                  disabled={busy === `add-${c.tmdbId}`}
                  className="inline-flex items-center gap-[6px] rounded-pill bg-red px-[16px] py-[8px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
                >
                  <Plus size={15} strokeWidth={1.5} />
                  {busy === `add-${c.tmdbId}` ? 'Тяну…' : 'Добавить'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
            В коллекции — {entries.length}
          </h2>
          <div className="grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[1280px]:grid-cols-6">
            {entries.map((entry) => (
              <Poster key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
