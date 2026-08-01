import type { FileStatus, Kind, Status } from './db/schema';

export type { FileStatus, Kind, Status };

/** Облегчённая запись — то, что отдаёт GET /api/movies. */
export type LightRow = {
  id: number;
  kind: Kind;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  runtime: number | null;
  genres: string | null;
  countries: string | null;
  director: string | null;
  ratingKp: number | null;
  ratingImdb: number | null;
  ratingTmdb: number | null;
  status: Status;
  rewatch: number;
  rating: number | null;
  tags: string | null;
  favorite: number;
  createdAt: string;
  fileStatus: FileStatus;
  storage: string | null;
  quality: string | null;
  progressSeason: number | null;
  progressEpisode: number | null;
};

/** Та же запись с разобранными JSON-полями — с ней работает весь клиент. */
export type Entry = Omit<LightRow, 'genres' | 'countries' | 'tags'> & {
  genres: string[];
  countries: string[];
  tags: string[];
  /** id подборок, в которых состоит запись. Проставляется каталогом. */
  lists?: string[];
};

export const STATUS_LABELS: Record<Status, string> = {
  none: 'Не смотрел',
  watched: 'Смотрел',
  planned: 'Буду смотреть',
  watching: 'Смотрю',
  skip: 'Не стоит смотреть',
};

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  none: 'Нет',
  downloading: 'Качаю',
  have: 'Скачан',
  deleted: 'Удалён после просмотра',
};

function parseList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function decode(row: LightRow): Entry {
  return {
    ...row,
    genres: parseList(row.genres),
    countries: parseList(row.countries),
    tags: parseList(row.tags),
  };
}

/** Десятилетие записи: 1979 → 1970. */
export function decadeOf(year: number | null): number | null {
  return year === null ? null : Math.floor(year / 10) * 10;
}

/** Считает, сколько раз встречается каждое значение, и сортирует по убыванию. */
export function countBy(entries: Entry[], pick: (e: Entry) => string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const value of pick(entry)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
}

/**
 * Число под постером: своя оценка золотом, а если её нет — оценка КП
 * приглушённым. Золото по 6.4 остаётся признаком оценки и нигде больше.
 */
export function posterRating(entry: Entry): { value: string; own: boolean } | null {
  if (entry.rating !== null) return { value: String(entry.rating), own: true };
  if (entry.ratingKp !== null) return { value: entry.ratingKp.toFixed(1), own: false };
  return null;
}

const DAY = 86_400_000;

/** Служебная подпись над названием в карусели: СЕГОДНЯ, 2 ДНЯ НАЗАД, 12 МАРТА. */
export function addedLabel(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const days = Math.floor((startOfDay(now) - startOfDay(date.getTime())) / DAY);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  if (days < 14) return 'неделю назад';
  if (days < 31) return `${Math.floor(days / 7)} ${plural(Math.floor(days / 7), 'неделю', 'недели', 'недель')} назад`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** «247 записей» / «38 записей». */
export function entriesWord(n: number): string {
  return plural(n, 'запись', 'записи', 'записей');
}
