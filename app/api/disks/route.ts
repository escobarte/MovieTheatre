import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { disks, movies } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Диски со сводкой. Занято — сумма веса фильмов с этим диском; фильмы без
 * введённого веса в сумму не попадают, поэтому отдельно считается, сколько
 * их: без этого числа остаток выглядел бы точным, хотя он завышен.
 */
export async function GET() {
  try {
    const db = getDb();

    const [rows, all] = await Promise.all([
      db.select().from(disks).orderBy(asc(disks.label)),
      db.select({ diskId: movies.diskId, sizeGb: movies.sizeGb }).from(movies),
    ]);

    return NextResponse.json({
      disks: rows.map((disk) => {
        const onDisk = all.filter((movie) => movie.diskId === disk.id);
        const used = onDisk.reduce((sum, movie) => sum + (movie.sizeGb ?? 0), 0);
        const unknown = onDisk.filter((movie) => movie.sizeGb === null).length;

        return {
          ...disk,
          usedGb: round(used),
          freeGb: round(disk.sizeGb - used),
          movies: onDisk.length,
          moviesWithoutSize: unknown,
        };
      }),
    });
  } catch (error) {
    console.error('[api/disks GET]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  let body: { label?: unknown; sizeGb?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON { label, sizeGb }' }, { status: 400 });
  }

  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const sizeGb = Number(body.sizeGb);

  if (!label) return NextResponse.json({ error: 'Нужна метка диска' }, { status: 400 });
  if (!Number.isFinite(sizeGb) || sizeGb <= 0) {
    return NextResponse.json({ error: 'Нужен объём диска в ГБ' }, { status: 400 });
  }

  try {
    const db = getDb();

    const [taken] = await db.select({ id: disks.id }).from(disks).where(eq(disks.label, label)).limit(1);
    if (taken) {
      return NextResponse.json({ error: `Диск «${label}» уже заведён` }, { status: 409 });
    }

    const [created] = await db
      .insert(disks)
      .values({
        label,
        sizeGb,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
      })
      .returning();

    return NextResponse.json(
      { disk: { ...created, usedGb: 0, freeGb: created.sizeGb, movies: 0, moviesWithoutSize: 0 } },
      { status: 201 },
    );
  } catch (error) {
    console.error('[api/disks POST]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** Гигабайты храним с одним знаком: точнее не нужно, а хвосты float мешают. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
