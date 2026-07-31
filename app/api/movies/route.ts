import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies, type Kind } from '@/lib/db/schema';
import { buildRecord } from '@/lib/merge';

export const dynamic = 'force-dynamic';

/**
 * Облегчённые поля по разделу 4: без overview, cast, producers, note и
 * backdropUrl. При 2000 записей полная выдача весила бы мегабайты,
 * облегчённая грузится один раз за сессию.
 *
 * Сверх перечисленного в разделе 4 добавлены fileStatus, storage, quality и
 * прогресс по сериалу: без них не собрать полку «Смотрю сейчас» и «Буду
 * смотреть, уже скачано» (5.2) и не отфильтровать по файлу, хранилищу и
 * качеству (5.4) — а фильтрация по условию идёт целиком в памяти клиента.
 * Это короткие строки и числа, вес выдачи почти не меняется.
 */
const lightColumns = {
  id: movies.id,
  kind: movies.kind,
  title: movies.title,
  originalTitle: movies.originalTitle,
  year: movies.year,
  posterUrl: movies.posterUrl,
  runtime: movies.runtime,
  genres: movies.genres,
  countries: movies.countries,
  director: movies.director,
  ratingKp: movies.ratingKp,
  ratingImdb: movies.ratingImdb,
  ratingTmdb: movies.ratingTmdb,
  status: movies.status,
  rewatch: movies.rewatch,
  rating: movies.rating,
  tags: movies.tags,
  favorite: movies.favorite,
  createdAt: movies.createdAt,
  fileStatus: movies.fileStatus,
  storage: movies.storage,
  quality: movies.quality,
  progressSeason: movies.progressSeason,
  progressEpisode: movies.progressEpisode,
};

export async function GET() {
  try {
    const rows = await getDb()
      .select(lightColumns)
      .from(movies)
      .orderBy(desc(movies.createdAt), desc(movies.id));

    return NextResponse.json({ movies: rows });
  } catch (error) {
    console.error('[api/movies GET]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Тело { tmdbId, kind }. Сервер тянет TMDB → КП, сливает, пишет и
 * возвращает готовую запись. Отказ Кинопоиска добавление не роняет.
 */
export async function POST(request: Request) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  let body: { tmdbId?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON { tmdbId, kind }' }, { status: 400 });
  }

  const tmdbId = Number(body.tmdbId);
  const kind = body.kind as Kind;

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: 'tmdbId должен быть числом' }, { status: 400 });
  }
  if (kind !== 'movie' && kind !== 'tv') {
    return NextResponse.json({ error: "kind должен быть 'movie' или 'tv'" }, { status: 400 });
  }

  try {
    const db = getDb();

    const [duplicate] = await db
      .select({ id: movies.id, title: movies.title })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);

    if (duplicate) {
      return NextResponse.json(
        { error: `Уже добавлено: «${duplicate.title}»`, id: duplicate.id },
        { status: 409 },
      );
    }

    const record = await buildRecord(tmdbId, kind);
    const [saved] = await db.insert(movies).values(record).returning();

    return NextResponse.json({ movie: saved }, { status: 201 });
  } catch (error) {
    console.error('[api/movies POST]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
