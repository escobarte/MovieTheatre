/**
 * Восстановление базы из файла «Скачать копию» (SPEC 9, docs/README.md).
 *
 *   npx tsx scripts/restore.ts путь/к/movie-theatre-ГГГГ-ММ-ДД.json
 *
 * Адрес и токен базы берутся из окружения (TURSO_DATABASE_URL,
 * TURSO_AUTH_TOKEN), а если их там нет — из .env.local. Пишет только в
 * пустую базу с уже применёнными миграциями из drizzle/: если хоть в одной
 * из пяти таблиц есть строки, ничего не меняет. Флага перезаписи нет и не
 * будет. Всё пишется одной транзакцией с исходными id; ошибка — откат всего.
 */

import { readFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { createClient, type Client, type InStatement } from '@libsql/client';
import { config } from 'dotenv';

import {
  BACKUP_APP,
  BACKUP_SCHEMA,
  BACKUP_TABLES,
  BACKUP_VERSION,
  type Backup,
  type BackupRow,
  type BackupTable,
} from '../lib/backup';

const KNOWN_VERSIONS = [BACKUP_VERSION];

const LABELS: Record<BackupTable, string> = {
  disks: 'дисков',
  movies: 'записей',
  lists: 'списков',
  list_items: 'позиций в списках',
  saved_views: 'сохранённых фильтров',
};

class Stop extends Error {}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Stop('Укажите файл копии: npx tsx scripts/restore.ts путь/к/файлу.json');

  const backup = readBackup(path);

  config({ path: '.env.local', quiet: true });
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Stop('TURSO_DATABASE_URL не задан — пропишите адрес новой базы в .env.local');

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const columns = await checkTarget(client, backup);

    console.log('');
    console.log(`Файл:   ${path}`);
    console.log(`Копия:  от ${backup.exportedAt}, схема ${backup.schema}`);
    console.log(`База:   ${safeUrl(url)}`);
    if (backup.schema !== BACKUP_SCHEMA) {
      console.log(`        внимание: схема в репозитории — ${BACKUP_SCHEMA}`);
    }
    console.log('');
    console.log('Будет записано:');
    for (const table of BACKUP_TABLES) {
      console.log(`  ${String(backup[table].length).padStart(6)}  ${LABELS[table]} (${table})`);
    }
    console.log('');

    if (!(await confirm('Восстановить? (да/нет) '))) {
      console.log('Отменено, база не менялась.');
      return;
    }

    const written = await write(client, backup, columns);

    console.log('');
    console.log('Готово. В базе теперь:');
    for (const table of BACKUP_TABLES) {
      console.log(`  ${String(written[table]).padStart(6)}  ${LABELS[table]} (${table})`);
    }
  } finally {
    client.close();
  }
}

/* ─── Файл ───────────────────────────────────────────────────────────── */

function readBackup(path: string): Backup {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Stop(`Не удалось прочитать файл ${path}: ${(error as Error).message}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Stop('Файл не похож на копию: это не JSON.');
  }

  if (!isObject(data) || data.app !== BACKUP_APP) {
    throw new Stop(`Файл не похож на копию Movie_Theatre: нет "app": "${BACKUP_APP}".`);
  }
  if (typeof data.version !== 'number' || !KNOWN_VERSIONS.includes(data.version)) {
    throw new Stop(
      `Неизвестная версия копии: ${JSON.stringify(data.version)}. Скрипт знает: ${KNOWN_VERSIONS.join(', ')}.`,
    );
  }

  for (const table of BACKUP_TABLES) {
    const rows = data[table];
    if (!Array.isArray(rows)) throw new Stop(`В файле нет массива "${table}" — копия неполная.`);
    rows.forEach((row, i) => {
      if (!isObject(row)) throw new Stop(`${table}[${i}]: ожидается объект.`);
      for (const [column, value] of Object.entries(row)) {
        if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
          throw new Stop(`${table}[${i}].${column}: значение должно быть строкой, числом или null.`);
        }
      }
    });
  }

  return {
    app: BACKUP_APP,
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : 'неизвестно когда',
    schema: typeof data.schema === 'string' ? data.schema : 'неизвестна',
    ...(Object.fromEntries(BACKUP_TABLES.map((table) => [table, data[table]])) as Record<
      BackupTable,
      BackupRow[]
    >),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* ─── База ───────────────────────────────────────────────────────────── */

/**
 * Таблицы есть, все пустые, и каждая колонка из файла в них есть.
 * Возвращает колонки таблиц: из них же собираются запросы.
 */
async function checkTarget(client: Client, backup: Backup): Promise<Record<BackupTable, Set<string>>> {
  const columns = {} as Record<BackupTable, Set<string>>;

  for (const table of BACKUP_TABLES) {
    const info = await client.execute(`PRAGMA table_info("${table}")`);
    if (info.rows.length === 0) {
      throw new Stop(`В базе нет таблицы ${table}. Сначала примените миграции из drizzle/ (см. docs/README.md).`);
    }
    columns[table] = new Set(info.rows.map((row) => String(row.name)));
  }

  if (!(await isEmpty(client))) {
    throw new Stop('База не пустая. Восстановление делается только в пустую базу.');
  }

  for (const table of BACKUP_TABLES) {
    const missing = new Set<string>();
    for (const row of backup[table]) {
      for (const column of Object.keys(row)) if (!columns[table].has(column)) missing.add(column);
    }
    if (missing.size > 0) {
      throw new Stop(
        `В таблице ${table} нет колонок: ${[...missing].join(', ')}. Похоже, к базе применены не все миграции из drizzle/.`,
      );
    }
  }

  return columns;
}

async function isEmpty(client: Pick<Client, 'execute'>): Promise<boolean> {
  for (const table of BACKUP_TABLES) {
    const result = await client.execute(`SELECT COUNT(*) AS n FROM "${table}"`);
    if (Number(result.rows[0].n) > 0) return false;
  }
  return true;
}

async function write(
  client: Client,
  backup: Backup,
  columns: Record<BackupTable, Set<string>>,
): Promise<Record<BackupTable, number>> {
  const statements: InStatement[] = [];
  for (const table of BACKUP_TABLES) {
    for (const row of backup[table]) {
      // Имена колонок сверены с PRAGMA table_info: в запрос попадают только настоящие.
      const names = Object.keys(row).filter((column) => columns[table].has(column));
      statements.push({
        sql: `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
        args: names.map((n) => row[n]),
      });
    }
  }

  const tx = await client.transaction('write');
  try {
    // Ещё раз внутри транзакции: между проверкой и записью база могла измениться.
    if (!(await isEmpty(tx))) throw new Stop('База не пустая. Восстановление делается только в пустую базу.');
    if (statements.length > 0) await tx.batch(statements);

    const written = {} as Record<BackupTable, number>;
    for (const table of BACKUP_TABLES) {
      const result = await tx.execute(`SELECT COUNT(*) AS n FROM "${table}"`);
      written[table] = Number(result.rows[0].n);
      if (written[table] !== backup[table].length) {
        throw new Error(`${table}: записано ${written[table]} из ${backup[table].length}`);
      }
    }

    await tx.commit();
    return written;
  } catch (error) {
    await tx.rollback().catch(() => {});
    if (error instanceof Stop) throw error;
    throw new Stop(`Ошибка при записи, всё откачено, база осталась пустой.\n${(error as Error).message}`);
  } finally {
    tx.close();
  }
}

/** Адрес без токена и прочих параметров. */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url.split('?')[0];
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    // Ввод закрыли, не ответив (Ctrl+D, пустой поток) — это «нет».
    const answer = await new Promise<string>((resolve) => {
      rl.once('close', () => resolve(''));
      rl.question(question).then(resolve, () => resolve(''));
    });
    return answer.trim().toLowerCase() === 'да';
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('');
  console.error(error instanceof Stop ? error.message : error);
  process.exitCode = 1;
});
