import 'server-only';

import { sql } from 'drizzle-orm';

import { getDb } from './index';

export type DbHealth =
  | { ok: true; tables: string[] }
  | { ok: false; error: string };

/**
 * Простая проверка, что Turso отвечает: один запрос и список таблиц,
 * созданных миграцией. Нужна на первом этапе, дальше не используется.
 */
export async function checkDb(): Promise<DbHealth> {
  try {
    const db = getDb();

    await db.get<{ ok: number }>(sql`select 1 as ok`);

    const rows = await db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`,
    );

    return { ok: true, tables: rows.map((r) => r.name) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
