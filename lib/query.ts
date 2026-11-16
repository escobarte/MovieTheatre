/**
 * Имена параметров строки запроса. Состояние фильтров и сортировки живёт
 * в URL (5.4) — отсюда работают «назад», закладки и сохранённые фильтры.
 * Ключи вынесены сюда, чтобы ссылки с Главной и разбор в каталоге
 * не разъехались.
 */
export const QP = {
  type: 'type',
  genre: 'genre',
  status: 'status',
  decade: 'decade',
  country: 'country',
  director: 'director',
  tag: 'tag',
  file: 'file',
  disk: 'disk',
  quality: 'quality',
  runtime: 'runtime',
  list: 'list',
  rewatch: 'rewatch',
  favorite: 'fav',
  min: 'min',
  minOf: 'minof',
  sort: 'sort',
} as const;

/** Ссылка на каталог с уже включённым условием. */
export function catalogHref(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `/vse-kino?${search}` : '/vse-kino';
}
