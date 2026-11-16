import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { searchMulti } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

/**
 * Проксирует /search/multi и отдаёт до 8 кандидатов с типом, годом,
 * мини-постером и режиссёром. Уже добавленные помечены (5.8).
 * Ключ TMDB остаётся на сервере.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!query) return NextResponse.json({ results: [] });

  try {
    const candidates = await searchMulti(query);
    if (!candidates.length) return NextResponse.json({ results: [] });

    const existing = await getDb()
      .select({ tmdbId: movies.tmdbId })
      .from(movies)
      .where(
        inArray(
          movies.tmdbId,
          candidates.map((c) => c.tmdbId),
        ),
      );

    const added = new Set(existing.map((row) => row.tmdbId));

    return NextResponse.json({
      results: candidates.map((c) => ({ ...c, added: added.has(c.tmdbId) })),
    });
  } catch (error) {
    console.error('[api/search]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
