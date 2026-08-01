import {
  FILE_STATUS_LABELS,
  STATUS_LABELS,
  decadeOf,
  type Entry,
  type FileStatus,
  type Status,
} from './collection';
import { QP } from './query';

/**
 * Отбор и сортировка идут целиком в памяти (5.4). Логика одна на весь экран:
 * внутри категории значения по «или», между категориями по «и».
 */

export type TypeFilter = 'all' | 'movie' | 'tv';
export type RatingSource = 'own' | 'kp' | 'imdb' | 'tmdb';
export type SortKey =
  | 'added'
  | 'own'
  | 'kp'
  | 'imdb'
  | 'tmdb'
  | 'year'
  | 'runtime'
  | 'title'
  | 'random';

export type Filters = {
  type: TypeFilter;
  genre: string[];
  status: string[];
  decade: string[];
  country: string[];
  director: string[];
  tag: string[];
  file: string[];
  disk: string[];
  quality: string[];
  runtime: string[];
  list: string[];
  rewatch: boolean;
  favorite: boolean;
  min: number;
  minOf: RatingSource;
  sort: SortKey;
};

/** Категории со списком значений — по ним же считаются счётчики. */
export type ListCategory =
  | 'genre'
  | 'status'
  | 'decade'
  | 'country'
  | 'director'
  | 'tag'
  | 'file'
  | 'disk'
  | 'quality'
  | 'runtime'
  | 'list';

export const EMPTY: Filters = {
  type: 'all',
  genre: [],
  status: [],
  decade: [],
  country: [],
  director: [],
  tag: [],
  file: [],
  disk: [],
  quality: [],
  runtime: [],
  list: [],
  rewatch: false,
  favorite: false,
  min: 0,
  minOf: 'own',
  sort: 'added',
};

export const RUNTIME_BUCKETS: { value: string; label: string; test: (m: number) => boolean }[] = [
  { value: 'short', label: 'до 90 мин', test: (m) => m < 90 },
  { value: 'medium', label: '90–120 мин', test: (m) => m >= 90 && m < 120 },
  { value: 'long', label: '120–150 мин', test: (m) => m >= 120 && m < 150 },
  { value: 'epic', label: 'от 150 мин', test: (m) => m >= 150 },
];

export const RATING_SOURCES: { value: RatingSource; label: string }[] = [
  { value: 'own', label: 'моя оценка' },
  { value: 'kp', label: 'КП' },
  { value: 'imdb', label: 'IMDb' },
  { value: 'tmdb', label: 'TMDB' },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'added', label: 'дата добавления' },
  { value: 'own', label: 'моя оценка' },
  { value: 'kp', label: 'оценка КП' },
  { value: 'imdb', label: 'оценка IMDb' },
  { value: 'tmdb', label: 'оценка TMDB' },
  { value: 'year', label: 'год' },
  { value: 'runtime', label: 'хронометраж' },
  { value: 'title', label: 'алфавит' },
  { value: 'random', label: 'случайно' },
];

/* ─── Значения записи по категориям ──────────────────────────────────── */

export function valuesOf(entry: Entry, category: ListCategory): string[] {
  switch (category) {
    case 'genre':
      return entry.genres;
    case 'status':
      return [entry.status];
    case 'decade': {
      const decade = decadeOf(entry.year);
      return decade === null ? [] : [String(decade)];
    }
    case 'country':
      return entry.countries;
    case 'director':
      return entry.director ? [entry.director] : [];
    case 'tag':
      return entry.tags;
    case 'file':
      return [entry.fileStatus];
    // Хранилище заменил диск: он выбирается из заведённых, а не пишется руками.
    case 'disk':
      return entry.diskId === null ? [] : [String(entry.diskId)];
    case 'quality':
      return entry.quality ? [entry.quality] : [];
    case 'runtime': {
      if (entry.runtime === null) return [];
      const bucket = RUNTIME_BUCKETS.find((b) => b.test(entry.runtime as number));
      return bucket ? [bucket.value] : [];
    }
    // Состав подборок приходит не из облегчённой выдачи, а из /api/lists —
    // каталог проставляет его записям перед отбором.
    case 'list':
      return entry.lists ?? [];
  }
}

export function labelOf(category: ListCategory, value: string): string {
  switch (category) {
    case 'status':
      return STATUS_LABELS[value as Status] ?? value;
    case 'file':
      return FILE_STATUS_LABELS[value as FileStatus] ?? value;
    case 'decade':
      return `${value}-е`;
    case 'runtime':
      return RUNTIME_BUCKETS.find((b) => b.value === value)?.label ?? value;
    case 'genre':
      return value.charAt(0).toUpperCase() + value.slice(1);
    default:
      return value;
  }
}

export function ratingOf(entry: Entry, source: RatingSource): number | null {
  switch (source) {
    case 'own':
      return entry.rating;
    case 'kp':
      return entry.ratingKp;
    case 'imdb':
      return entry.ratingImdb;
    case 'tmdb':
      return entry.ratingTmdb;
  }
}

/* ─── Отбор ──────────────────────────────────────────────────────────── */

const LIST_CATEGORIES: ListCategory[] = [
  'genre',
  'status',
  'decade',
  'country',
  'director',
  'tag',
  'file',
  'disk',
  'quality',
  'runtime',
  'list',
];

/** Все условия, кроме одного — так считаются счётчики этой категории. */
function passes(entry: Entry, filters: Filters, except?: string): boolean {
  if (except !== 'type' && filters.type !== 'all' && entry.kind !== filters.type) return false;
  if (except !== 'rewatch' && filters.rewatch && entry.rewatch !== 1) return false;
  if (except !== 'favorite' && filters.favorite && entry.favorite !== 1) return false;

  if (except !== 'min' && filters.min > 0) {
    const rating = ratingOf(entry, filters.minOf);
    if (rating === null || rating < filters.min) return false;
  }

  for (const category of LIST_CATEGORIES) {
    if (category === except) continue;
    const selected = filters[category];
    if (selected.length === 0) continue;

    // Внутри категории — «или».
    const values = valuesOf(entry, category);
    if (!selected.some((value) => values.includes(value))) return false;
  }

  return true;
}

export function applyFilters(entries: Entry[], filters: Filters): Entry[] {
  return entries.filter((entry) => passes(entry, filters));
}

/**
 * Счётчик у каждого значения считается с учётом остальных включённых
 * фильтров, но без учёта своей категории — иначе невыбранные значения
 * всегда показывали бы ноль (5.4).
 */
export function facetCounts(
  entries: Entry[],
  filters: Filters,
  category: ListCategory,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!passes(entry, filters, category)) continue;
    for (const value of valuesOf(entry, category)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return counts;
}

export function typeCounts(entries: Entry[], filters: Filters): Record<TypeFilter, number> {
  const pool = entries.filter((entry) => passes(entry, filters, 'type'));
  return {
    all: pool.length,
    movie: pool.filter((e) => e.kind === 'movie').length,
    tv: pool.filter((e) => e.kind === 'tv').length,
  };
}

export function flagCount(entries: Entry[], filters: Filters, flag: 'rewatch' | 'favorite'): number {
  return entries.filter((entry) => passes(entry, filters, flag) && entry[flag] === 1).length;
}

/* ─── Сортировка ─────────────────────────────────────────────────────── */

/** Пустые значения всегда в конце, каким бы ни был порядок. */
function byNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function byNumberAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function sortEntries(entries: Entry[], sort: SortKey, seed: number): Entry[] {
  const sorted = [...entries];

  switch (sort) {
    case 'added':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    case 'own':
      return sorted.sort((a, b) => byNumber(a.rating, b.rating));
    case 'kp':
      return sorted.sort((a, b) => byNumber(a.ratingKp, b.ratingKp));
    case 'imdb':
      return sorted.sort((a, b) => byNumber(a.ratingImdb, b.ratingImdb));
    case 'tmdb':
      return sorted.sort((a, b) => byNumber(a.ratingTmdb, b.ratingTmdb));
    case 'year':
      return sorted.sort((a, b) => byNumber(a.year, b.year));
    case 'runtime':
      // Короткие сначала: сортировка нужна, когда ищут «что успею за вечер».
      return sorted.sort((a, b) => byNumberAsc(a.runtime, b.runtime));
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    case 'random':
      return sorted.sort((a, b) => shuffleKey(a.id, seed) - shuffleKey(b.id, seed));
  }
}

/** Порядок случайный, но устойчивый: пока seed тот же, сетка не прыгает. */
function shuffleKey(id: number, seed: number): number {
  const x = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ─── Строка запроса ─────────────────────────────────────────────────── */

const LIST_PARAM: Record<ListCategory, string> = {
  genre: QP.genre,
  status: QP.status,
  decade: QP.decade,
  country: QP.country,
  director: QP.director,
  tag: QP.tag,
  file: QP.file,
  disk: QP.disk,
  quality: QP.quality,
  runtime: QP.runtime,
  list: QP.list,
};

export function parseFilters(params: URLSearchParams): Filters {
  const list = (key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const type = params.get(QP.type);
  const sort = params.get(QP.sort);
  const minOf = params.get(QP.minOf);

  return {
    ...EMPTY,
    type: type === 'movie' || type === 'tv' ? type : 'all',
    genre: list(QP.genre),
    status: list(QP.status),
    decade: list(QP.decade),
    country: list(QP.country),
    director: list(QP.director),
    tag: list(QP.tag),
    file: list(QP.file),
    disk: list(QP.disk),
    quality: list(QP.quality),
    runtime: list(QP.runtime),
    list: list(QP.list),
    rewatch: params.get(QP.rewatch) === '1',
    favorite: params.get(QP.favorite) === '1',
    min: clampRating(Number(params.get(QP.min))),
    minOf: RATING_SOURCES.some((s) => s.value === minOf) ? (minOf as RatingSource) : 'own',
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : 'added',
  };
}

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 10);
}

export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();

  if (filters.type !== 'all') params.set(QP.type, filters.type);
  for (const category of LIST_CATEGORIES) {
    if (filters[category].length) params.set(LIST_PARAM[category], filters[category].join(','));
  }
  if (filters.rewatch) params.set(QP.rewatch, '1');
  if (filters.favorite) params.set(QP.favorite, '1');
  if (filters.min > 0) {
    params.set(QP.min, String(filters.min));
    if (filters.minOf !== 'own') params.set(QP.minOf, filters.minOf);
  }
  if (filters.sort !== 'added') params.set(QP.sort, filters.sort);

  return params.toString();
}

/** Есть ли хоть одно условие — от этого зависит показ «Сбросить фильтры». */
export function isFiltered(filters: Filters): boolean {
  return (
    filters.type !== 'all' ||
    filters.rewatch ||
    filters.favorite ||
    filters.min > 0 ||
    LIST_CATEGORIES.some((category) => filters[category].length > 0)
  );
}

/** Человекочитаемый перечень включённых условий — для пустого результата (5.6). */
export function activeConditions(filters: Filters): string[] {
  const out: string[] = [];

  if (filters.type !== 'all') out.push(filters.type === 'movie' ? 'Фильмы' : 'Сериалы');
  for (const category of LIST_CATEGORIES) {
    for (const value of filters[category]) out.push(labelOf(category, value));
  }
  if (filters.rewatch) out.push('Хочу пересмотреть');
  if (filters.favorite) out.push('Избранное');
  if (filters.min > 0) {
    const source = RATING_SOURCES.find((s) => s.value === filters.minOf)?.label ?? '';
    out.push(`${source} ${filters.min}+`);
  }

  return out;
}
