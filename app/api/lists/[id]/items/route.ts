import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { listItems, lists } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

type Incoming = { movieId: number; position?: number; note?: string | null };

/**
 * Полный состав с порядком — одним запросом после перетаскивания (раздел 4).
 * Порядок внутри списка это смысловая часть, поэтому он всегда переписывается
 * целиком: так не бывает состояния, где две записи делят одну позицию.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  const listId = Number((await params).id);
  if (!Number.isInteger(listId)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON { items }' }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items должен быть массивом' }, { status: 400 });
  }

  const incoming = (body.items as Incoming[])
    .filter((item) => Number.isInteger(item?.movieId))
    .map((item, index) => ({
      listId,
      movieId: item.movieId,
      position: Number.isInteger(item.position) ? (item.position as number) : index,
      note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : null,
    }))
    .sort((a, b) => a.position - b.position);

  // Один фильм в списке один раз: первичный ключ (listId, movieId). При
  // повторе остаётся первое вхождение, а позиции перенумеровываются подряд —
  // иначе в базе оседали бы дыры вроде 1, 2, 5.
  const seen = new Set<number>();
  const unique: typeof incoming = [];
  for (const item of incoming) {
    if (seen.has(item.movieId)) continue;
    seen.add(item.movieId);
    unique.push({ ...item, position: unique.length });
  }

  try {
    const db = getDb();

    const [list] = await db.select({ id: lists.id }).from(lists).where(eq(lists.id, listId)).limit(1);
    if (!list) return NextResponse.json({ error: 'Список не найден' }, { status: 404 });

    await db.transaction(async (tx) => {
      await tx.delete(listItems).where(eq(listItems.listId, listId));
      if (unique.length) await tx.insert(listItems).values(unique);
    });

    return NextResponse.json({
      items: unique.map(({ movieId, position, note }) => ({ movieId, position, note })),
    });
  } catch (error) {
    console.error('[api/lists items PUT]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
