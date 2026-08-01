'use client';

import { Bookmark, Shuffle, Star, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';

import { FilterSelect, type Option } from '@/components/catalog/FilterSelect';
import { PickOne } from '@/components/catalog/PickOne';
import { useCollection } from '@/components/CollectionProvider';
import { useLists } from '@/components/ListsProvider';
import { Poster } from '@/components/Poster';
import { entriesWord, type Entry } from '@/lib/collection';
import {
  EMPTY,
  RATING_SOURCES,
  SORTS,
  activeConditions,
  applyFilters,
  facetCounts,
  flagCount,
  isFiltered,
  labelOf,
  parseFilters,
  serializeFilters,
  sortEntries,
  typeCounts,
  type Filters,
  type ListCategory,
  type RatingSource,
  type SortKey,
  type TypeFilter,
} from '@/lib/filters';

const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'movie', label: 'Фильмы' },
  { value: 'tv', label: 'Сериалы' },
];

/** Минимальная оценка: список вместо ползунка — «любая», затем 1+ … 10. */
const MIN_RATINGS = [
  { value: '0', label: 'любая' },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: i + 1 === 10 ? '10' : `${i + 1}+`,
  })),
];

/** Порядок второй строки — из 5.3; остальные категории 5.4 идут следом. */
const SELECTORS: { category: ListCategory; label: string }[] = [
  { category: 'status', label: 'Статус' },
  { category: 'decade', label: 'Десятилетие' },
  { category: 'country', label: 'Страна' },
  { category: 'file', label: 'Файл' },
  { category: 'storage', label: 'Хранилище' },
  { category: 'runtime', label: 'Хронометраж' },
  { category: 'director', label: 'Режиссёр' },
  { category: 'tag', label: 'Тег' },
  { category: 'quality', label: 'Качество' },
  { category: 'list', label: 'Список' },
];

export default function CatalogPage() {
  return (
    <Suspense fallback={<p className="py-10 text-text-3">Загружаю коллекцию</p>}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const { entries: raw, loading, error } = useCollection();
  const { lists, createView } = useLists();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [seed, setSeed] = useState(1);
  const [pick, setPick] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewTitle, setViewTitle] = useState('');

  /** Состав подборок живёт отдельно от коллекции — сшиваем перед отбором. */
  const entries = useMemo(() => {
    if (lists.length === 0) return raw;

    const byMovie = new Map<number, string[]>();
    for (const list of lists) {
      for (const item of list.items) {
        byMovie.set(item.movieId, [...(byMovie.get(item.movieId) ?? []), String(list.id)]);
      }
    }

    return raw.map((entry) => ({ ...entry, lists: byMovie.get(entry.id) ?? [] }));
  }, [raw, lists]);

  const listTitles = useMemo(
    () => new Map(lists.map((list) => [String(list.id), list.title])),
    [lists],
  );

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  /**
   * Состояние фильтров живёт в URL — отсюда работают «назад» и закладки (5.4).
   * Каждое переключение кладётся в историю отдельной записью.
   */
  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next = serializeFilters({ ...filters, ...patch });
      router.push(next ? `/vse-kino?${next}` : '/vse-kino', { scroll: false });
      setPick(null);
    },
    [filters, router],
  );

  /** Сброс снимает условия, но не сортировку — сортировка не фильтр. */
  const reset = useCallback(
    () => update({ ...EMPTY, sort: filters.sort, minOf: filters.minOf }),
    [update, filters.sort, filters.minOf],
  );

  // Отбор и сортировка — в памяти, без обращений к серверу.
  const found = useMemo(() => applyFilters(entries, filters), [entries, filters]);
  const visible = useMemo(() => sortEntries(found, filters.sort, seed), [found, filters.sort, seed]);

  const counts = useMemo(() => typeCounts(entries, filters), [entries, filters]);
  const genreOptions = useMemo(() => options(entries, filters, 'genre'), [entries, filters]);
  const rewatchCount = useMemo(() => flagCount(entries, filters, 'rewatch'), [entries, filters]);
  const favoriteCount = useMemo(() => flagCount(entries, filters, 'favorite'), [entries, filters]);

  if (loading) return <p className="py-10 text-text-3">Загружаю коллекцию</p>;
  if (error) return <p className="py-10 text-text-3">Коллекция не загрузилась: {error}</p>;

  const filtered = isFiltered(filters);

  const chooseForMe = () => {
    if (visible.length === 0) return;
    setPick(visible[Math.floor(Math.random() * visible.length)]);
  };

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h1 className="text-[22px] font-bold">Всё кино</h1>
        <span className="text-[12.5px] text-text-3">
          {entries.length} {entriesWord(entries.length)}
        </span>
        <span className="flex-1" />

        <div className="flex rounded-pill bg-surface p-[3px]">
          {TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => update({ type: type.value })}
              className={`rounded-pill px-[17px] py-[7px] text-[12.5px] transition-colors duration-[120ms] ${
                filters.type === type.value
                  ? 'bg-surface-3 font-medium text-text'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              {type.label}
              <span className="ml-[6px] text-text-3">{counts[type.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Первая строка — жанры пилюлями, самое частое (5.3). */}
      {genreOptions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-[6px]">
          {genreOptions.map((option) => {
            const on = filters.genre.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  update({
                    genre: on
                      ? filters.genre.filter((g) => g !== option.value)
                      : [...filters.genre, option.value],
                  })
                }
                className={`rounded-pill px-[15px] py-[7px] whitespace-nowrap transition-colors duration-[120ms] ${
                  on
                    ? 'bg-red font-medium text-white hover:bg-red-hover'
                    : 'text-text-2 hover:bg-surface hover:text-text'
                }`}
              >
                {option.label}
                <span className={`ml-[6px] ${on ? 'text-white/70' : 'text-text-3'}`}>
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Вторая строка — выпадающие. */}
      <div className="mt-[11px] flex flex-wrap gap-[7px]">
        {SELECTORS.map(({ category, label }) => (
          <FilterSelect
            key={category}
            label={label}
            options={options(entries, filters, category, category === 'list' ? listTitles : undefined)}
            selected={filters[category]}
            onChange={(next) => update({ [category]: next } as Partial<Filters>)}
          />
        ))}

        <Toggle
          label="Хочу пересмотреть"
          on={filters.rewatch}
          count={rewatchCount}
          onClick={() => update({ rewatch: !filters.rewatch })}
        />
        <Toggle
          label="Избранное"
          on={filters.favorite}
          count={favoriteCount}
          onClick={() => update({ favorite: !filters.favorite })}
        />
      </div>

      {/* Полоса результата. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-[14px]">
        <span className="text-[12.5px] text-text-2">
          <span className="font-medium text-text">{found.length}</span> из {entries.length}
        </span>

        {/* Появляется, только когда что-то выбрано, и снимает все категории разом. */}
        {filtered && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-[6px] rounded-pill bg-red px-[14px] py-[7px] text-[12px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            <X size={13} strokeWidth={1.5} />
            Сбросить все фильтры
          </button>
        )}

        {/* Сохранённый фильтр — имя плюс текущая строка запроса (2.5). */}
        {filtered &&
          (saving ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!viewTitle.trim()) return;
                await createView(viewTitle.trim(), serializeFilters(filters));
                setViewTitle('');
                setSaving(false);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={viewTitle}
                onChange={(e) => setViewTitle(e.target.value)}
                placeholder="Название фильтра"
                onKeyDown={(e) => e.key === 'Escape' && setSaving(false)}
                className="w-[190px] rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] caret-red outline-none"
              />
              <button
                type="submit"
                className="rounded-pill bg-red px-[14px] py-[7px] text-[12px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
              >
                Сохранить
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="inline-flex items-center gap-[6px] rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] font-medium text-text transition-colors duration-[120ms] hover:bg-surface"
            >
              <Bookmark size={13} strokeWidth={1.5} />
              Сохранить фильтр
            </button>
          ))}

        <button
          type="button"
          onClick={chooseForMe}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-[6px] rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] font-medium text-text transition-colors duration-[120ms] hover:bg-surface disabled:text-text-3"
        >
          <Shuffle size={13} strokeWidth={1.5} />
          Выбери за меня
        </button>

        <span className="flex-1" />

        <PickOne<SortKey>
          label="Сортировка"
          value={filters.sort}
          options={SORTS}
          onChange={(sort) => {
            setSeed((s) => s + 1);
            update({ sort });
          }}
        />

        <span className="flex items-center gap-2">
          <Star size={14} strokeWidth={1.5} className="fill-gold text-gold" />
          <PickOne<string>
            label="Оценка"
            value={String(filters.min)}
            options={MIN_RATINGS}
            onChange={(min) => update({ min: Number(min) })}
          />
          <PickOne<RatingSource>
            value={filters.minOf}
            options={RATING_SOURCES}
            onChange={(minOf) => update({ minOf })}
          />
        </span>
      </div>

      {pick && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface p-3">
          <div className="w-[68px] shrink-0">
            <Poster entry={pick} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
              Выбрано за тебя
            </p>
            <p className="mt-1 text-[15px] font-bold">{pick.title}</p>
            <p className="mt-1 text-[11.5px] text-text-3">
              {[pick.year, pick.director].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={chooseForMe}
            className="rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] font-medium"
          >
            Ещё раз
          </button>
        </div>
      )}

      {visible.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[1280px]:grid-cols-6">
          {visible.map((entry) => (
            <Poster key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <NothingMatches filters={filters} onReset={reset} />
      )}
    </div>
  );
}

function options(
  entries: Entry[],
  filters: Filters,
  category: ListCategory,
  titles?: Map<string, string>,
): Option[] {
  const counts = facetCounts(entries, filters, category);

  return [...counts]
    .map(([value, count]) => ({
      value,
      label: titles?.get(value) ?? labelOf(category, value),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
}

function Toggle({
  label,
  on,
  count,
  onClick,
}: {
  label: string;
  on: boolean;
  count: number;
  onClick: () => void;
}) {
  if (count === 0 && !on) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] rounded-pill px-[14px] py-[7px] text-[12px] whitespace-nowrap transition-colors duration-[120ms] ${
        on ? 'bg-surface-3 text-text' : 'bg-surface text-text-2 hover:text-text'
      }`}
    >
      {label}
      <span className="text-text-3">{count}</span>
    </button>
  );
}

/**
 * Второе пустое состояние (5.6): записи есть, просто не подходят.
 * Предлагать добавление здесь нельзя — это другая ошибка.
 */
function NothingMatches({ filters, onReset }: { filters: Filters; onReset: () => void }) {
  const conditions = activeConditions(filters);

  return (
    <div className="mt-4 rounded-lg bg-surface p-[26px] text-center">
      <p className="text-[14px] font-medium">Под выбранные условия ничего не подходит</p>

      {conditions.length > 0 && (
        <p className="mt-2 text-[12.5px] text-text-3">{conditions.join(' · ')}</p>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
      >
        Сбросить фильтры
      </button>
    </div>
  );
}
