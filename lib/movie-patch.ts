/**
 * Правка записи (5.7) приводится к виду схемы одинаково в карточке и на
 * сервере. Списки — JSON string[]: по запятой, trim, без пустых и повторов
 * (без учёта регистра), порядок сохраняется; жанры в нижнем регистре.
 * Режиссёр — строка «A, B» по тем же правилам. Пустой текст — null.
 * Числа — число или null. Неверное значение — ошибка, запись не меняется.
 */

export const LIST_FIELDS = ['producers', 'cast', 'genres', 'countries', 'tags'] as const;
export type ListField = (typeof LIST_FIELDS)[number];

/** Текст, где пустая строка значит «нет значения». */
const NULLABLE_TEXT = [
  'imdbId',
  'originalTitle',
  'posterUrl',
  'backdropUrl',
  'trailerKey',
  'overview',
  'note',
  'torrentUrl',
  'storage',
  'path',
  'quality',
] as const;

/** Целые ≥ 0. */
const INTEGERS = ['year', 'runtime', 'seasons', 'episodes', 'progressSeason', 'progressEpisode', 'kpId'] as const;

/** Дробные ≥ 0, до десятых; у оценок ещё и верхняя граница 10. */
const DECIMALS: Record<string, number> = {
  sizeGb: Infinity,
  ratingKp: 10,
  ratingImdb: 10,
  ratingTmdb: 10,
};

const sameKey = (value: string) => value.toLowerCase().replaceAll('ё', 'е');

/** Значения из массива или из строки через запятую — чистые, без повторов. */
export function cleanValues(input: string | string[], lowercase = false): string[] {
  const raw = typeof input === 'string' ? input.split(',') : input;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const value = lowercase ? item.trim().toLowerCase() : item.trim();
    if (!value || seen.has(sameKey(value))) continue;
    seen.add(sameKey(value));
    out.push(value);
  }
  return out;
}

/** Режиссёр из строки через запятую: «A, B» или null. */
export function directorValue(input: string): string | null {
  const values = cleanValues(input);
  return values.length ? values.join(', ') : null;
}

/** Список из строки через запятую: JSON string[] или null. */
export function listValue(field: ListField, input: string | string[]): string | null {
  const values = cleanValues(input, field === 'genres');
  return values.length ? JSON.stringify(values) : null;
}

function toNumber(key: string, value: unknown): number | null {
  if (value === null || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`${key}: ожидается число не меньше 0`);
  return number;
}

/** Приводит правку к виду схемы; поля, которых здесь нет, пропускает как есть. */
export function normalizePatch(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields };

  if ('title' in fields) {
    const value = fields.title;
    if (typeof value !== 'string' || value.trim() === '') throw new Error('Название не может быть пустым');
    out.title = value.trim();
  }

  if ('director' in fields) {
    const value = fields.director;
    if (value === null) out.director = null;
    else if (typeof value === 'string') out.director = directorValue(value);
    else throw new Error('director: ожидается строка');
  }

  for (const key of NULLABLE_TEXT) {
    if (!(key in fields)) continue;
    const value = fields[key];
    if (value === null) out[key] = null;
    else if (typeof value === 'string') out[key] = value.trim() === '' ? null : value.trim();
    else throw new Error(`${key}: ожидается строка`);
  }

  if ('watchedAt' in fields) {
    const value = fields.watchedAt;
    if (value === null || value === '') out.watchedAt = null;
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) out.watchedAt = value.trim();
    else throw new Error('watchedAt: ожидается дата ГГГГ-ММ-ДД');
  }

  for (const key of INTEGERS) {
    if (!(key in fields)) continue;
    const number = toNumber(key, fields[key]);
    out[key] = number === null ? null : Math.round(number);
  }

  for (const [key, max] of Object.entries(DECIMALS)) {
    if (!(key in fields)) continue;
    const number = toNumber(key, fields[key]);
    if (number !== null && number > max) throw new Error(`${key}: не больше ${max}`);
    out[key] = number === null ? null : Math.round(number * 10) / 10;
  }

  if ('rating' in fields) {
    const number = toNumber('rating', fields.rating);
    if (number !== null && (!Number.isInteger(number) || number < 1 || number > 10)) {
      throw new Error('rating: целое от 1 до 10');
    }
    out.rating = number;
  }

  for (const field of LIST_FIELDS) {
    if (!(field in fields)) continue;
    const value = fields[field];
    if (value === null) {
      out[field] = null;
      continue;
    }

    // JSON string[] или (как в поле карточки) строка через запятую.
    let items: unknown = value;
    if (typeof value === 'string') {
      if (!value.trim().startsWith('[')) {
        items = value.split(',');
      } else {
        try {
          items = JSON.parse(value);
        } catch {
          throw new Error(`${field}: ожидается список строк`);
        }
      }
    }
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
      throw new Error(`${field}: ожидается список строк`);
    }
    out[field] = listValue(field, items as string[]);
  }

  return out;
}
