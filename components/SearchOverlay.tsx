'use client';

import { Image as ImageIcon, Plus, Search, SmilePlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { entriesWord, type Entry } from '@/lib/collection';
import { searchEntries, searchTitles } from '@/lib/search';

import { useCard } from './CardProvider';
import { useCollection } from './CollectionProvider';
import { useLists, type MovieList } from './ListsProvider';

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

/** Строка, на которую можно встать стрелками и нажать Enter. */
type Row =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'list'; list: MovieList }
  | { kind: 'candidate'; candidate: Candidate };

/**
 * Оверлей поиска (5.5). Ищет по мере ввода в уже загруженной коллекции,
 * без обращений к серверу. Когда в коллекции пусто — сразу блок «Найти
 * и добавить» с выдачей TMDB по тому же запросу (5.6): тупика быть не должно.
 */
export function SearchOverlay({
  mode,
  onClose,
}: {
  mode: 'search' | 'add';
  onClose: () => void;
}) {
  const { entries, reload } = useCollection();
  const { lists } = useLists();
  const { openCard } = useCard();

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);

  const found = useMemo(() => searchEntries(entries, query), [entries, query]);
  const foundLists = useMemo(() => searchTitles(lists, query), [lists, query]);

  const movies = found.filter((entry) => entry.kind === 'movie');
  const series = found.filter((entry) => entry.kind === 'tv');

  // В режиме добавления TMDB спрашивается всегда, в поиске — только когда
  // в коллекции ничего не нашлось.
  const wantTmdb = mode === 'add' || (query.trim().length > 1 && found.length === 0);

  useEffect(() => {
    if (!wantTmdb || query.trim().length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setCandidates(res.ok ? data.results : []);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, wantTmdb]);

  const rows: Row[] = [
    ...movies.map((entry) => ({ kind: 'entry' as const, entry })),
    ...series.map((entry) => ({ kind: 'entry' as const, entry })),
    ...foundLists.map((list) => ({ kind: 'list' as const, list })),
    ...candidates.map((candidate) => ({ kind: 'candidate' as const, candidate })),
  ];

  useEffect(() => setCursor(0), [query]);

  async function add(candidate: Candidate) {
    setBusy(candidate.tmdbId);
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tmdbId: candidate.tmdbId, kind: candidate.kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCandidates((prev) =>
        prev.map((c) => (c.tmdbId === candidate.tmdbId ? { ...c, added: true } : c)),
      );
      await reload();
      onClose();
      openCard(data.movie.id, { justAdded: true });
    } catch {
      setBusy(null);
    }
  }

  const activate = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === 'entry') {
      onClose();
      openCard(row.entry.id);
    } else if (row.kind === 'list') {
      onClose();
      window.location.href = `/spiski/${row.list.id}`;
    } else if (!row.candidate.added) {
      void add(row.candidate);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') return onClose();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(rows[cursor]);
    }
  };

  const indexOf = (row: Row) => rows.findIndex((r) => sameRow(r, row));
  const nothingHere = query.trim().length > 0 && found.length === 0 && foundLists.length === 0;

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 p-4 sm:p-8"
      onKeyDown={onKeyDown}
    >
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center gap-[14px] rounded-md bg-surface px-[18px] py-4">
          <Search size={20} strokeWidth={1.5} className="shrink-0 text-text-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'add' ? 'Что добавить' : 'Поиск по коллекции'}
            className="min-w-0 flex-1 bg-transparent text-[18px] caret-red outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-text-3 transition-colors duration-[120ms] hover:text-text"
          >
            <X size={19} strokeWidth={1.5} />
          </button>
        </div>

        {mode === 'search' && query.trim() && (
          <>
            <Heading>В коллекции</Heading>

            {nothingHere ? (
              <div className="mt-[11px] rounded-md bg-surface p-[26px] text-center">
                <SmilePlus size={26} strokeWidth={1.5} className="mx-auto text-icon-dim" />
                <p className="mt-[11px] text-[14px] font-medium">Ничего не нашлось</p>
                <p className="mt-[5px] text-[12.5px] text-text-3">
                  Ни в названиях, ни у режиссёров, ни в тегах
                </p>
              </div>
            ) : (
              <div className="mt-[9px]">
                <Group title="Фильмы" count={movies.length}>
                  {movies.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      active={indexOf({ kind: 'entry', entry }) === cursor}
                      onClick={() => activate({ kind: 'entry', entry })}
                    />
                  ))}
                </Group>

                <Group title="Сериалы" count={series.length}>
                  {series.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      active={indexOf({ kind: 'entry', entry }) === cursor}
                      onClick={() => activate({ kind: 'entry', entry })}
                    />
                  ))}
                </Group>

                <Group title="Списки" count={foundLists.length}>
                  {foundLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => activate({ kind: 'list', list })}
                      className={`flex w-full items-center gap-[14px] rounded-sm px-3 py-[11px] text-left transition-colors duration-[120ms] hover:bg-surface ${
                        indexOf({ kind: 'list', list }) === cursor ? 'bg-surface' : ''
                      }`}
                    >
                      <span className="flex-1 text-[14px] font-medium">{list.title}</span>
                      <span className="text-[12px] text-text-3">
                        {list.items.length} {entriesWord(list.items.length)}
                      </span>
                    </button>
                  ))}
                </Group>
              </div>
            )}
          </>
        )}

        {(mode === 'add' || nothingHere) && query.trim().length > 1 && (
          <>
            <div className="mt-[26px] flex items-baseline gap-[9px]">
              <h2 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
                Найти и добавить
              </h2>
              <span className="text-[11px] text-icon-dim">TMDB</span>
            </div>

            {searching && <p className="mt-[9px] px-3 text-[12.5px] text-text-3">Ищу в TMDB</p>}

            {!searching && candidates.length === 0 && (
              <div className="mt-[9px] rounded-md bg-surface p-[26px] text-center">
                <p className="text-[14px] font-medium">Нигде не нашлось</p>
                <p className="mt-[5px] text-[12.5px] text-text-3">
                  Попробуйте оригинальное название — в TMDB старое и редкое кино часто
                  заведено только на нём
                </p>
              </div>
            )}

            <div className="mt-[9px]">
              {candidates.map((candidate) => (
                <CandidateRow
                  key={`${candidate.kind}-${candidate.tmdbId}`}
                  candidate={candidate}
                  busy={busy === candidate.tmdbId}
                  active={indexOf({ kind: 'candidate', candidate }) === cursor}
                  onAdd={() => add(candidate)}
                />
              ))}
            </div>
          </>
        )}

        <div className="mt-[18px] flex gap-4 px-3 text-[11.5px] text-text-4">
          <span>↑ ↓ выбрать</span>
          <span>Enter открыть</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </div>
  );
}

function sameRow(a: Row, b: Row): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'entry' && b.kind === 'entry') return a.entry.id === b.entry.id;
  if (a.kind === 'list' && b.kind === 'list') return a.list.id === b.list.id;
  if (a.kind === 'candidate' && b.kind === 'candidate') return a.candidate.tmdbId === b.candidate.tmdbId;
  return false;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-[24px] text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
      {children}
    </h2>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="mt-2">
      <h3 className="px-3 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
        {title} <span className="text-icon-dim">{count}</span>
      </h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex h-[57px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-xs bg-surface-2 text-icon-dim">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={16} strokeWidth={1.5} />
      )}
    </span>
  );
}

function EntryRow({
  entry,
  active,
  onClick,
}: {
  entry: Entry;
  active: boolean;
  onClick: () => void;
}) {
  const meta = [entry.year, entry.originalTitle, entry.director].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[14px] rounded-sm px-3 py-[11px] text-left transition-colors duration-[120ms] hover:bg-surface ${
        active ? 'bg-surface' : ''
      }`}
    >
      <Thumb url={entry.posterUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{entry.title}</span>
        <span className="mt-[3px] block truncate text-[12px] text-text-3">{meta || '—'}</span>
      </span>
    </button>
  );
}

function CandidateRow({
  candidate,
  busy,
  active,
  onAdd,
}: {
  candidate: Candidate;
  busy: boolean;
  active: boolean;
  onAdd: () => void;
}) {
  const meta = [
    candidate.year,
    candidate.kind === 'tv' ? 'сериал' : candidate.originalTitle,
    candidate.director,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`flex items-center gap-[14px] rounded-sm px-3 py-[11px] ${active ? 'bg-surface' : ''}`}
    >
      <Thumb url={candidate.posterUrl} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{candidate.title}</span>
        <span className="mt-[3px] block truncate text-[12px] text-text-3">{meta || '—'}</span>
      </span>

      {candidate.added ? (
        <span className="text-[12.5px] text-text-3">в коллекции</span>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="inline-flex items-center gap-[6px] rounded-pill bg-red px-[16px] py-[8px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={1.5} />
          {busy ? 'Тяну…' : 'Добавить'}
        </button>
      )}
    </div>
  );
}
