/**
 * Резервная копия (SPEC 4, 9): формат файла общий для экспорта
 * (`/api/export`) и восстановления (`scripts/restore.ts`). Строки таблиц
 * лежат как есть: имена колонок из базы, JSON-поля строками.
 */

import journal from '../drizzle/meta/_journal.json';

export const BACKUP_APP = 'Movie_Theatre';
export const BACKUP_VERSION = 1;

/** Последняя миграция из drizzle/ — по ней видно, под какую схему снята копия. */
export const BACKUP_SCHEMA: string = journal.entries[journal.entries.length - 1]?.tag ?? 'unknown';

/** Порядок записи при восстановлении: сначала те, на кого ссылаются. */
export const BACKUP_TABLES = ['disks', 'movies', 'lists', 'list_items', 'saved_views'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Порядок строк в файле, чтобы две копии одной базы совпадали. */
export const BACKUP_ORDER: Record<BackupTable, string> = {
  disks: 'id',
  movies: 'id',
  lists: 'id',
  list_items: 'list_id, position, movie_id',
  saved_views: 'id',
};

export type BackupRow = Record<string, string | number | null>;

export type Backup = {
  app: string;
  version: number;
  exportedAt: string;
  schema: string;
} & Record<BackupTable, BackupRow[]>;

/** Дата для имени файла — по Бухаресту, как живёт владелец: «2026-11-20». */
export function backupDate(now = new Date()): string {
  // en-CA пишет дату как ГГГГ-ММ-ДД.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Файл: шапка и по одной строке таблицы на строку текста. Это обычный JSON,
 * почти такой же компактный, как в одну строку, но его можно открыть и
 * прочитать глазами.
 */
export function serializeBackup(backup: Backup): string {
  const keys = Object.keys(backup) as (keyof Backup)[];
  const lines = ['{'];

  keys.forEach((key, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    const value = backup[key];
    const name = JSON.stringify(key);

    if (!Array.isArray(value)) {
      lines.push(`  ${name}: ${JSON.stringify(value)}${comma}`);
    } else if (value.length === 0) {
      lines.push(`  ${name}: []${comma}`);
    } else {
      lines.push(`  ${name}: [`);
      value.forEach((row, j) => lines.push(`    ${JSON.stringify(row)}${j < value.length - 1 ? ',' : ''}`));
      lines.push(`  ]${comma}`);
    }
  });

  lines.push('}');
  return lines.join('\n') + '\n';
}
