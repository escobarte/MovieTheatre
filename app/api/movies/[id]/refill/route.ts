import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies, type NewMovie } from '@/lib/db/schema';
import { buildFromApi } from '@/lib/merge';

export const dynamic = 'force-dynamic';

/**
 * Поля, которые приходят из API (2.2). Всё остальное — kind, tmdbId, личное,
 * файл, дата добавления, состав списков — перезаполнение не трогает.
 */
const API_FIELDS = [
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
] as const satisfies readonly (keyof NewMovie)[];

/**
 * Ручное перезаполнение из TMDB и Кинопоиска тем же кодом, что при добавлении.
 * Не ответил TMDB — ничего не меняется, ошибка. Кинопоиск не дал записи
 * (сбой, не нашёл, нет imdbId) — его поля остаются прежними, а не null;
 * при сбое в ответе kpFailed: true.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Неверный id' }, { status: 400 });
  }

  const db = getDb();

  let current;
  try {
    [current] = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
  } catch (error) {
    console.error('[api/movies refill read]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });

  let built;
  try {
    built = await buildFromApi(current.tmdbId, current.kind);
  } catch (error) {
    console.error('[api/movies refill tmdb]', error);
    return NextResponse.json(
      { error: `TMDB не ответил: ${(error as Error).message}` },
      { status: 502 },
    );
  }

  const patch: Partial<NewMovie> = Object.fromEntries(
    API_FIELDS.map((field) => [field, built.record[field] ?? null]),
  );

  if (!built.kp.data) {
    // Название тоже из КП (kp.name → TMDB), постер — из КП, если у TMDB его нет.
    patch.kpId = current.kpId;
    patch.ratingKp = current.ratingKp;
    patch.ratingImdb = current.ratingImdb;
    patch.title = current.title;
    if (!patch.posterUrl) patch.posterUrl = current.posterUrl;
  }

  patch.updatedAt = new Date().toISOString();

  try {
    const [saved] = await db.update(movies).set(patch).where(eq(movies.id, id)).returning();
    return NextResponse.json({ movie: saved, kpFailed: built.kp.failed });
  } catch (error) {
    console.error('[api/movies refill write]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
