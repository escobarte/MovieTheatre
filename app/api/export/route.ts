import type { ResultSet } from '@libsql/client';
import { NextResponse } from 'next/server';

import {
  BACKUP_APP,
  BACKUP_ORDER,
  BACKUP_SCHEMA,
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupDate,
  serializeBackup,
  type Backup,
  type BackupRow,
} from '@/lib/backup';
import { getClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Вся база одним JSON-файлом (SPEC 4, 9). Только чтение: все таблицы
 * читаются одной читающей транзакцией, поэтому копия согласована. Колонки
 * как в базе, без облегчения. Закрыт входом, как всё /api (middleware).
 */
export async function GET() {
  try {
    const results = await getClient().batch(
      BACKUP_TABLES.map((table) => `SELECT * FROM "${table}" ORDER BY ${BACKUP_ORDER[table]}`),
      'read',
    );
    const rows = Object.fromEntries(BACKUP_TABLES.map((table, i) => [table, toRows(results[i])]));

    const now = new Date();
    const backup: Backup = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      schema: BACKUP_SCHEMA,
      movies: rows.movies,
      lists: rows.lists,
      list_items: rows.list_items,
      saved_views: rows.saved_views,
      disks: rows.disks,
    };

    return new Response(serializeBackup(backup), {
      headers: {
        ...NO_STORE,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="movie-theatre-${backupDate(now)}.json"`,
      },
    });
  } catch (error) {
    console.error('[api/export GET]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500, headers: NO_STORE });
  }
}

function toRows(result: ResultSet): BackupRow[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, i) => [column, plain(row[i])])),
  );
}

/** В схеме только текст, числа и NULL; bigint на всякий случай — числом. */
function plain(value: unknown): string | number | null {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new Error(`Неожиданное значение в базе: ${typeof value}`);
}
