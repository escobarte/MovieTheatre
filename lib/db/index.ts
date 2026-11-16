import 'server-only';

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import * as schema from './schema';

export { schema };

let client: Client | undefined;
let database: LibSQLDatabase<typeof schema> | undefined;

/**
 * Клиент создаётся лениво: переменных окружения может не быть на этапе сборки,
 * и падать из-за этого билд не должен — падает только реальный запрос.
 */
export function getDb(): LibSQLDatabase<typeof schema> {
  if (database) return database;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error('TURSO_DATABASE_URL не задан — проверьте .env.local или переменные Vercel');
  }

  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  database = drizzle(client, { schema });
  return database;
}
