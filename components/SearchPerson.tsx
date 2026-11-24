'use client';

import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DEPARTMENT_LABEL, type Credit, type PersonCredits, type PersonHit } from '@/lib/person';

import { LAYER, useLayer } from './layers';
import { type Candidate, CandidateRow, candidateKey } from './SearchRows';

/**
 * Люди в поиске (5.5): блок «Люди» над результатами TMDB и фильмография
 * человека в том же окне (?person=<id>). Строки работ — те же CandidateRow,
 * что у обычных результатов: клик открывает поп-ап, «Добавить» добавляет сразу.
 */

const PAGE = 20;
const TTL_MS = 30 * 60 * 1000;
const MAX_CACHED = 50;

/** Фильмографии в памяти вкладки: повторный переход к человеку мгновенный. */
const cache = new Map<number, { at: number; data: PersonCredits }>();

function cached(id: number): PersonCredits | null {
  const hit = cache.get(id);
  return hit && Date.now() - hit.at < TTL_MS ? hit.data : null;
}

/** Название работы из загруженной фильмографии — для подписи поп-апа. */
export function creditTitle(personId: number, key: string): string | null {
  const data = cached(personId);
  const all = data ? [...data.actor, ...data.director] : [];
  return all.find((c) => candidateKey(c) === key)?.title ?? null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

function Avatar({ person }: { person: Pick<PersonHit, 'name' | 'photoUrl'> }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-2 text-[13px] font-medium text-text-2">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}

export function PeopleBlock({
  people,
  activeId,
  onOpen,
}: {
  people: PersonHit[];
  /** id человека под курсором ↑ ↓, если курсор в блоке. */
  activeId: number | null;
  onOpen: (person: PersonHit, keyboard?: boolean) => void;
}) {
  if (people.length === 0) return null;

  return (
    <section className="mt-[9px]">
      <h3 className="px-3 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">Люди</h3>
      <div className="mt-1">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => onOpen(person)}
            className={`flex w-full items-center gap-[14px] rounded-sm px-3 py-[8px] text-left transition-colors duration-[120ms] hover:bg-surface ${
              activeId === person.id ? 'bg-surface' : ''
            }`}
          >
            <Avatar person={person} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{person.name}</span>
              <span className="mt-[3px] block truncate text-[12px] text-text-3">
                {DEPARTMENT_LABEL[person.department]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; data: PersonCredits };

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-pill border px-[15px] py-[7px] text-[12px] transition-colors duration-[120ms] ${
        selected
          ? 'border-red bg-red font-medium text-white hover:bg-red-hover'
          : 'border-line-strong text-text hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Фильмография человека. Пока грузится — скелетон; пусто — «Фильмов не
 * нашлось»; ошибка — «Не удалось загрузить» и «Назад». Esc закрывает её
 * своим слоем (выше поиска, ниже поп-апа).
 */
export function PersonView({
  id,
  hit,
  isAdded,
  busyKey,
  onOpen,
  onAdd,
  onBack,
}: {
  id: number;
  /** Человек из блока «Люди», если пришли оттуда: имя видно сразу. */
  hit: PersonHit | null;
  isAdded: (key: string) => boolean;
  busyKey: string | null;
  onOpen: (candidate: Candidate) => void;
  onAdd: (candidate: Candidate) => void;
  onBack: () => void;
}) {
  const [load, setLoad] = useState<Load>(() => {
    const hitData = cached(id);
    return hitData ? { state: 'ready', data: hitData } : { state: 'loading' };
  });
  const [direction, setDirection] = useState<'actor' | 'director' | null>(null);
  const [shown, setShown] = useState(PAGE);

  useLayer(LAYER.person, true, onBack);

  useEffect(() => {
    const hitData = cached(id);
    if (hitData) {
      setLoad({ state: 'ready', data: hitData });
      return;
    }

    setLoad({ state: 'loading' });
    const controller = new AbortController();

    fetch(`/api/search/person?id=${id}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        return data as PersonCredits;
      })
      .then((data) => {
        cache.delete(id);
        cache.set(id, { at: Date.now(), data });
        if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
        setLoad({ state: 'ready', data });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setLoad({ state: 'error' });
      });

    return () => controller.abort();
  }, [id]);

  const data = load.state === 'ready' ? load.data : null;
  const person = data?.person ?? hit;

  // Основное направление — по known_for_department; если там пусто — другое.
  const hasBoth = data !== null && data.actor.length > 0 && data.director.length > 0;
  const main: 'actor' | 'director' = !data
    ? 'actor'
    : data.person.department === 'director'
      ? data.director.length > 0
        ? 'director'
        : 'actor'
      : data.actor.length > 0
        ? 'actor'
        : 'director';
  const current = direction ?? main;
  const credits: Credit[] = data ? data[current] : [];

  const serverAdded = new Set(data?.added);
  const rows = credits.slice(0, shown).map(
    (credit): Candidate => ({
      ...credit,
      added: serverAdded.has(candidateKey(credit)) || isAdded(candidateKey(credit)),
    }),
  );

  const choose = (next: 'actor' | 'director') => {
    setDirection(next);
    setShown(PAGE);
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-[6px] rounded-pill bg-surface-3 px-[16px] py-[9px] text-[13px] font-medium transition-colors duration-[120ms] hover:bg-line-strong"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Назад
        </button>
        {person && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar person={person} />
            <h2 className="min-w-0 truncate text-[22px] leading-tight font-bold">{person.name}</h2>
          </div>
        )}
      </div>

      <div className="mt-[22px] flex items-baseline gap-[9px]">
        <h2 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
          Фильмография
        </h2>
        <span className="text-[11px] text-icon-dim">TMDB</span>
      </div>

      {hasBoth && (
        <div className="mt-[11px] flex gap-2">
          <Pill selected={current === 'actor'} onClick={() => choose('actor')}>
            Актёр
          </Pill>
          <Pill selected={current === 'director'} onClick={() => choose('director')}>
            Режиссёр
          </Pill>
        </div>
      )}

      {load.state === 'loading' && (
        <div className="mt-[9px]" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-[14px] px-3 py-[11px]">
              <span className="h-[57px] w-[38px] shrink-0 rounded-xs bg-surface-2" />
              <span className="min-w-0 flex-1">
                <span className="block h-[14px] w-[55%] rounded-xs bg-surface-2" />
                <span className="mt-[8px] block h-[12px] w-[35%] rounded-xs bg-surface-2" />
              </span>
            </div>
          ))}
        </div>
      )}

      {load.state === 'error' && (
        <div className="mt-[9px] rounded-md bg-surface p-[26px] text-center">
          <AlertCircle size={26} strokeWidth={1.5} className="mx-auto text-orange" />
          <p className="mt-[11px] text-[14px] font-medium">Не удалось загрузить</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-[14px] inline-flex items-center gap-[6px] rounded-pill bg-surface-3 px-[16px] py-[9px] text-[13px] font-medium transition-colors duration-[120ms] hover:bg-line-strong"
          >
            <ArrowLeft size={15} strokeWidth={1.5} />
            Назад
          </button>
        </div>
      )}

      {data && credits.length === 0 && (
        <div className="mt-[9px] rounded-md bg-surface p-[26px] text-center">
          <p className="text-[14px] font-medium">Фильмов не нашлось</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-[9px]">
          {rows.map((candidate) => (
            <CandidateRow
              key={candidateKey(candidate)}
              candidate={candidate}
              busy={busyKey === candidateKey(candidate)}
              active={false}
              onOpen={() => onOpen(candidate)}
              onAdd={() => onAdd(candidate)}
            />
          ))}
        </div>
      )}

      {credits.length > shown && (
        <div className="mt-[10px] flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="rounded-pill border border-line-strong px-[15px] py-[7px] text-[12px] transition-colors duration-[120ms] hover:bg-surface-2"
          >
            Показать ещё <span className="text-text-3">{credits.length - shown}</span>
          </button>
        </div>
      )}
    </div>
  );
}
