/** Списки хранятся JSON-строкой string[] (схема 2.1). */
const LIST_FIELDS = new Set(['genres', 'countries', 'producers', 'cast', 'tags']);

/** Текст, где пустая строка значит «нет значения». */
const NULLABLE_TEXT = new Set([
  'imdbId',
  'originalTitle',
  'posterUrl',
  'backdropUrl',
  'trailerKey',
  'overview',
  'director',
  'watchedAt',
  'note',
  'torrentUrl',
  'storage',
  'path',
  'quality',
]);

const RATINGS = new Set(['ratingKp', 'ratingImdb', 'ratingTmdb']);

const sameKey = (value: string) => value.toLowerCase().replaceAll('ё', 'е');

/**
 * Приводит правку к виду схемы: списки — JSON string[] без пустых и повторов
 * (жанры в нижнем регистре), пустые строки и пустые списки — null, оценки —
 * число 0–10 или null. Неверное значение — ошибка 400, запись не меняется.
 */
export function normalizePatch(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (LIST_FIELDS.has(key)) {
      out[key] = normalizeList(key, value);
    } else if (NULLABLE_TEXT.has(key)) {
      if (value === null) out[key] = null;
      else if (typeof value === 'string') out[key] = value.trim() === '' ? null : value.trim();
      else throw new Error(`${key}: ожидается строка`);
    } else if (RATINGS.has(key)) {
      if (value === null || value === '') {
        out[key] = null;
      } else {
        const rating = Number(value);
        if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
          throw new Error(`${key}: оценка от 0 до 10`);
        }
        out[key] = Math.round(rating * 10) / 10;
      }
    } else if (key === 'title') {
      if (typeof value !== 'string' || value.trim() === '') throw new Error('Название не может быть пустым');
      out[key] = value.trim();
    } else {
      out[key] = value;
    }
  }

  return out;
}

function normalizeList(key: string, value: unknown): string | null {
  let items: unknown = value;
  if (typeof value === 'string') {
    try {
      items = value.trim() === '' ? [] : JSON.parse(value);
    } catch {
      throw new Error(`${key}: ожидается список строк`);
    }
  }
  if (items === null) return null;
  if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
    throw new Error(`${key}: ожидается список строк`);
  }

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of items as string[]) {
    const item = key === 'genres' ? raw.trim().toLowerCase() : raw.trim();
    if (!item || seen.has(sameKey(item))) continue;
    seen.add(sameKey(item));
    clean.push(item);
  }
  return clean.length ? JSON.stringify(clean) : null;
}
