import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies, type Kind } from '@/lib/db/schema';
import { buildFromApi } from '@/lib/merge';
import { type PreviewMovie, type PreviewResponse, toPreview } from '@/lib/preview';

export const dynamic = 'force-dynamic';

/**
 * Предпросмотр результата поиска TMDB (5.8): тот же сбор TMDB → Кинопоиск
 * → слияние, что при добавлении, но без записи в базу. Из базы только
 * читается, есть ли запись с этим tmdbId, — той же проверкой, что защищает
 * POST /api/movies от дубликатов.
 *
 * У Кинопоиска 200 запросов в сутки, поэтому собранное держится в памяти
 * функции полчаса: повторное открытие того же поп-апа квоту не тратит.
 * Ответ со сбоем Кинопоиска не запоминается — следующее открытие спросит снова.
 */
const TTL_MS = 30 * 60 * 1000;
const MAX_CACHED = 100;
const cache = new Map<string, { at: number; movie: PreviewMovie }>();

async function preview(tmdbId: number, kind: Kind): Promise<PreviewMovie> {
  const key = `${kind}-${tmdbId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.movie;

  const { record, kp } = await buildFromApi(tmdbId, kind);
  const movie = toPreview(record);

  if (!kp.failed) {
    cache.delete(key);
    cache.set(key, { at: Date.now(), movie });
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return movie;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tmdbId = Number(params.get('tmdbId'));
  const kind = params.get('type');

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: 'tmdbId должен быть числом' }, { status: 400 });
  }
  if (kind !== 'movie' && kind !== 'tv') {
    return NextResponse.json({ error: "type должен быть 'movie' или 'tv'" }, { status: 400 });
  }

  try {
    const [movie, [existing]] = await Promise.all([
      preview(tmdbId, kind),
      getDb().select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId)).limit(1),
    ]);

    const body: PreviewResponse = { movie, added: Boolean(existing), id: existing?.id ?? null };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/search/preview]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
