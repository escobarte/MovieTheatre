import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import type { Credit, PersonCredits } from '@/lib/person';
import { getPersonCredits, searchPeople } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

/**
 * Люди в поиске (5.5). Два режима, в базу ничего не пишется:
 *  - ?q= — до трёх человек из /search/person (запрос от трёх символов);
 *  - ?id= — фильмография человека из TMDB: актёрская и режиссёрская,
 *    уже отфильтрованные и отсортированные. Кинопоиск не используется.
 *
 * Фильмография из TMDB держится в памяти функции полчаса (до 100 людей);
 * отметка «в коллекции» читается из базы при каждом запросе.
 */
const TTL_MS = 30 * 60 * 1000;
const MAX_CACHED = 100;
type Cached = Omit<PersonCredits, 'added'>;
const cache = new Map<number, { at: number; data: Cached }>();

async function credits(id: number): Promise<Cached> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const data = await getPersonCredits(id);
  cache.delete(id);
  cache.set(id, { at: Date.now(), data });
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return data;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    const q = params.get('q');
    if (q !== null) {
      const query = q.trim();
      if (query.length < 3) return NextResponse.json({ people: [] });
      return NextResponse.json({ people: await searchPeople(query) });
    }

    const id = Number(params.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'id должен быть числом' }, { status: 400 });
    }

    const data = await credits(id);
    const all: Credit[] = [...data.actor, ...data.director];
    const ids = [...new Set(all.map((c) => c.tmdbId))];

    const existing = ids.length
      ? await getDb()
          .select({ tmdbId: movies.tmdbId, kind: movies.kind })
          .from(movies)
          .where(inArray(movies.tmdbId, ids))
      : [];

    const body: PersonCredits = {
      ...data,
      added: existing.map((row) => `${row.kind}-${row.tmdbId}`),
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/search/person]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
