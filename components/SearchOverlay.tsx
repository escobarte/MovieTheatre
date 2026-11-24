'use client';

import { Search, SmilePlus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { entriesWord, type Entry } from '@/lib/collection';
import type { PersonHit } from '@/lib/person';
import { searchEntries, searchTitles } from '@/lib/search';

import { useCard } from './CardProvider';
import { useCollection } from './CollectionProvider';
import { LAYER, useLayer } from './layers';
import { useLists, type MovieList } from './ListsProvider';
import { PeopleBlock, PersonView, creditTitle } from './SearchPerson';
import { type AddOutcome, SearchPreview } from './SearchPreview';
import { type Candidate, CandidateRow, Thumb, candidateKey } from './SearchRows';
import { URL_PARAM, pushParam, replaceParam, useCloseParam, useUrlParam } from './url-state';

/** ?p=movie-603 → { kind, tmdbId }. */
function parsePreview(value: string | null): Pick<Candidate, 'kind' | 'tmdbId'> | null {
  const match = value ? /^(movie|tv)-(\d+)$/.exec(value) : null;
  return match ? { kind: match[1] as Candidate['kind'], tmdbId: Number(match[2]) } : null;
}

/** Строка, на которую можно встать стрелками и нажать Enter. */
type Row =
  | { kind: 'entry'; entry: Entry }
  | { kind: 'list'; list: MovieList }
  | { kind: 'person'; person: PersonHit }
  | { kind: 'candidate'; candidate: Candidate };

/**
 * Оверлей поиска (5.5). Ищет по мере ввода в уже загруженной коллекции,
 * без обращений к серверу. Когда в коллекции пусто — сразу блок «Найти
 * и добавить» с выдачей TMDB по тому же запросу (5.6): тупика быть не должно.
 *
 * Клик или Enter по результату TMDB открывает поп-ап с полными сведениями
 * (SearchPreview, ?p= в адресе) — поверх, не закрывая оверлей: запрос,
 * выдача и прокрутка остаются. Кнопка «Добавить» в строке — быстрое
 * добавление без поп-апа.
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
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [searching, setSearching] = useState(false);
  // Добавленное в этой сессии окна: отметка «в коллекции» в фильмографии.
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const [openedPerson, setOpenedPerson] = useState<PersonHit | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  useLayer(LAYER.search, true, onClose);

  const previewParam = useUrlParam(URL_PARAM.preview);
  const preview = parsePreview(previewParam);
  const closePreview = useCloseParam(URL_PARAM.preview, 'mtPreview', previewParam);
  const previewed = preview
    ? candidates.find((c) => c.kind === preview.kind && c.tmdbId === preview.tmdbId)
    : undefined;

  const personParam = useUrlParam(URL_PARAM.person);
  const personId = personParam !== null && /^\d+$/.test(personParam) ? Number(personParam) : null;
  const closePerson = useCloseParam(URL_PARAM.person, 'mtPerson', personParam);
  const personHit = personId !== null && openedPerson?.id === personId ? openedPerson : null;

  // Фильмография занимает то же окно: поиск под ней скрыт, но не размонтирован
  // (запрос и выдача остаются). Прокрутка выдачи запоминается и возвращается.
  const personOpen = personId !== null;
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    if (personOpen) box.scrollTop = 0;
    else box.scrollTop = savedScroll.current;
  }, [personOpen]);

  // Поп-ап открыт с клавиатуры — после закрытия фокус возвращается в поле,
  // чтобы снова работали ↑ ↓ и Enter. После касания — нет: на телефоне
  // это подняло бы клавиатуру.
  const byKeyboard = useRef(false);
  const previewOpen = preview !== null;
  useEffect(() => {
    if (previewOpen || personOpen || !byKeyboard.current) return;
    byKeyboard.current = false;
    // Поп-ап сменился карточкой после добавления — фокус остаётся в ней.
    if (new URLSearchParams(window.location.search).has(URL_PARAM.card)) return;
    input.current?.focus({ preventScroll: true });
  }, [previewOpen, personOpen]);

  const openPerson = (person: PersonHit, keyboard = false) => {
    byKeyboard.current = keyboard;
    savedScroll.current = scroller.current?.scrollTop ?? 0;
    setOpenedPerson(person);
    if (new URLSearchParams(window.location.search).has(URL_PARAM.person)) {
      replaceParam(URL_PARAM.person, String(person.id));
    } else {
      pushParam(URL_PARAM.person, String(person.id), 'mtPerson');
    }
  };

  const openPreview = (candidate: Candidate, keyboard = false) => {
    byKeyboard.current = keyboard;
    const value = candidateKey(candidate);
    if (new URLSearchParams(window.location.search).has(URL_PARAM.preview)) {
      replaceParam(URL_PARAM.preview, value);
    } else {
      pushParam(URL_PARAM.preview, value, 'mtPreview');
    }
  };

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
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setCandidates(res.ok ? data.results : []);
        setSearching(false);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setCandidates([]);
        setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, wantTmdb]);

  // Люди — отдельным запросом и параллельно фильмам: блок появляется, когда
  // ответит, и показ фильмов не задерживает. От трёх символов.
  useEffect(() => {
    if (!wantTmdb || query.trim().length < 3) {
      setPeople([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/person?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setPeople(res.ok ? data.people : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setPeople([]);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, wantTmdb]);

  const rows: Row[] = [
    ...movies.map((entry) => ({ kind: 'entry' as const, entry })),
    ...series.map((entry) => ({ kind: 'entry' as const, entry })),
    ...foundLists.map((list) => ({ kind: 'list' as const, list })),
    ...people.map((person) => ({ kind: 'person' as const, person })),
    ...candidates.map((candidate) => ({ kind: 'candidate' as const, candidate })),
  ];

  useEffect(() => setCursor(0), [query]);
  // Людей может стать меньше, пока курсор стоит на последнем.
  useEffect(() => setCursor((c) => Math.min(c, Math.max(rows.length - 1, 0))), [rows.length]);

  /**
   * Одно добавление на строку и поп-ап. Дубликаты отсекает сервер (409 —
   * tmdbId уже в базе): строка помечается «в коллекции», карточка не
   * открывается. Отметка — по tmdbId, как и проверка на сервере.
   */
  async function add(candidate: Pick<Candidate, 'kind' | 'tmdbId'>): Promise<AddOutcome> {
    const markAdded = () => {
      setCandidates((prev) =>
        prev.map((c) => (c.tmdbId === candidate.tmdbId ? { ...c, added: true } : c)),
      );
      setAddedKeys((prev) => new Set(prev).add(candidateKey(candidate)));
    };

    setBusy(candidateKey(candidate));
    try {
      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tmdbId: candidate.tmdbId, kind: candidate.kind }),
      });
      const data = await res.json();
      if (res.status === 409) {
        markAdded();
        setBusy(null);
        return 'duplicate';
      }
      if (!res.ok) throw new Error(data.error);

      markAdded();
      await reload();
      setBusy(null);
      // Поиск не закрывается: карточка ложится шагом истории поверх него,
      // «Назад» из карточки возвращает сюда (5.7). Из поп-апа — встаёт на
      // его место (CardProvider).
      openCard(data.movie.id, { justAdded: true });
      return 'added';
    } catch {
      setBusy(null);
      return 'error';
    }
  }

  const activate = (row: Row | undefined, keyboard = false) => {
    if (!row) return;
    if (row.kind === 'entry') {
      openCard(row.entry.id);
    } else if (row.kind === 'person') {
      openPerson(row.person, keyboard);
    } else if (row.kind === 'list') {
      window.location.href = `/spiski/${row.list.id}`;
    } else {
      openPreview(row.candidate, keyboard);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (previewOpen || personOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(rows[cursor], true);
    }
  };

  const indexOf = (row: Row) => rows.findIndex((r) => sameRow(r, row));
  const nothingHere = query.trim().length > 0 && found.length === 0 && foundLists.length === 0;

  return (
    <>
      <div
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        ref={scroller}
        className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 p-4 sm:p-8"
        onKeyDown={onKeyDown}
      >
        {personId !== null && (
          <PersonView
            key={personId}
            id={personId}
            hit={personHit}
            isAdded={(key) => addedKeys.has(key)}
            busyKey={busy}
            onOpen={(candidate) => openPreview(candidate)}
            onAdd={(candidate) => void add(candidate)}
            onBack={closePerson}
          />
        )}

        <div hidden={personOpen} className="mx-auto w-full max-w-[720px]">
          <div className="flex items-center gap-[14px] rounded-md bg-surface px-[18px] py-4">
            <Search size={20} strokeWidth={1.5} className="shrink-0 text-text-3" />
            <input
              ref={input}
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

              {!searching && candidates.length === 0 && people.length === 0 && (
                <div className="mt-[9px] rounded-md bg-surface p-[26px] text-center">
                  <p className="text-[14px] font-medium">Нигде не нашлось</p>
                  <p className="mt-[5px] text-[12.5px] text-text-3">
                    Попробуйте оригинальное название — в TMDB старое и редкое кино часто
                    заведено только на нём
                  </p>
                </div>
              )}

              <PeopleBlock
                people={people}
                activeId={rows[cursor]?.kind === 'person' ? (rows[cursor] as { person: PersonHit }).person.id : null}
                onOpen={openPerson}
              />

              <div className="mt-[9px]">
                {candidates.map((candidate) => (
                  <CandidateRow
                    key={candidateKey(candidate)}
                    candidate={candidate}
                    busy={busy === candidateKey(candidate)}
                    active={indexOf({ kind: 'candidate', candidate }) === cursor}
                    onOpen={() => openPreview(candidate)}
                    onAdd={() => void add(candidate)}
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

      {/* Соседом, а не внутри оверлея: клавиши из поп-апа не должны всплывать
          в onKeyDown поиска (Enter на кнопке иначе открыл бы строку под ним). */}
      {preview && (
        <SearchPreview
          key={candidateKey(preview)}
          kind={preview.kind}
          tmdbId={preview.tmdbId}
          title={previewed?.title ?? (personId !== null ? creditTitle(personId, candidateKey(preview)) : null)}
          added={previewed?.added ?? addedKeys.has(candidateKey(preview))}
          busy={busy === candidateKey(preview)}
          onAdd={() => add(preview)}
          onClose={closePreview}
        />
      )}
    </>
  );
}

function sameRow(a: Row, b: Row): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'entry' && b.kind === 'entry') return a.entry.id === b.entry.id;
  if (a.kind === 'list' && b.kind === 'list') return a.list.id === b.list.id;
  if (a.kind === 'person' && b.kind === 'person') return a.person.id === b.person.id;
  if (a.kind === 'candidate' && b.kind === 'candidate')
    return candidateKey(a.candidate) === candidateKey(b.candidate);
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
