import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * После импорта автополя и личные ничем не отличаются, поэтому правится
 * любое поле записи (раздел 4). Неизменны только id, tmdbId и дата
 * добавления; updatedAt проставляется схемой.
 */
const EDITABLE = new Set([
  'kind',
  'imdbId',
  'kpId',
  'title',
  'originalTitle',
  'year',
  'posterUrl',
  'backdropUrl',
  'trailerKey',
  'overview',
  'runtime',
  'seasons',
  'episodes',
  'genres',
  'countries',
  'director',
  'producers',
  'cast',
  'ratingKp',
  'ratingImdb',
  'ratingTmdb',
  'status',
  'rewatch',
  'rating',
  'watchedAt',
  'progressSeason',
  'progressEpisode',
  'note',
  'tags',
  'favorite',
  'fileStatus',
  'torrentUrl',
  'storage',
  'diskId',
  'sizeGb',
  'path',
  'quality',
]);

/** Полная карточка — со всем, что не попадает в облегчённую выдачу. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Неверный id' }, { status: 400 });
  }

  try {
    const [movie] = await getDb().select().from(movies).where(eq(movies.id, id)).limit(1);
    if (!movie) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });

    return NextResponse.json({ movie });
  } catch (error) {
    console.error('[api/movies GET one]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Неверный id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON' }, { status: 400 });
  }

  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => EDITABLE.has(key)));
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Нет полей для изменения' }, { status: 400 });
  }

  try {
    const [saved] = await getDb()
      .update(movies)
      .set(patch)
      .where(eq(movies.id, id))
      .returning();

    if (!saved) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });

    return NextResponse.json({ movie: saved });
  } catch (error) {
    console.error('[api/movies PATCH]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
