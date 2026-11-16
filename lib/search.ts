import type { Entry } from './collection';

/**
 * Поиск идёт по уже загруженной коллекции — мгновенно, без обращения
 * к серверу (5.5). Поля: русское название, оригинальное, режиссёр,
 * актёры, теги.
 */

/** Регистр не важен, ё приравнивается к е, лишние пробелы отбрасываются. */
export function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function haystack(entry: Entry): string {
  return normalize(
    [entry.title, entry.originalTitle, entry.director, ...entry.cast, ...entry.tags]
      .filter(Boolean)
      .join(' '),
  );
}

/** Совпадение по подстроке в любом месте слова. */
export function matches(entry: Entry, query: string): boolean {
  return haystack(entry).includes(query);
}

export function searchEntries(entries: Entry[], rawQuery: string): Entry[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  return entries
    .filter((entry) => matches(entry, query))
    .sort((a, b) => rank(a, query) - rank(b, query) || a.title.localeCompare(b.title, 'ru'));
}

/**
 * Совпадение в начале названия важнее, чем в середине, а совпадение
 * в названии важнее, чем у актёра: иначе точный запрос тонет в однофамильцах.
 */
function rank(entry: Entry, query: string): number {
  const title = normalize(entry.title);
  const original = normalize(entry.originalTitle ?? '');

  if (title.startsWith(query) || original.startsWith(query)) return 0;
  if (title.includes(query) || original.includes(query)) return 1;
  if (normalize(entry.director ?? '').includes(query)) return 2;
  return 3;
}

export function searchTitles<T extends { title: string }>(items: T[], rawQuery: string): T[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  return items.filter((item) => normalize(item.title).includes(query));
}
