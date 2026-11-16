import { asc, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { listItems, lists } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Список подборок вместе с составом. Состав отдаётся одними id: сами записи
 * уже лежат в памяти клиента после облегчённой выдачи (5.4), поэтому число
 * записей, обложка и фильтр «список» считаются на месте, без второго запроса.
 */
export async function GET() {
  try {
    const db = getDb();

    const [rows, items] = await Promise.all([
      db.select().from(lists).orderBy(asc(lists.position), asc(lists.id)),
      db.select().from(listItems).orderBy(asc(listItems.position)),
    ]);

    return NextResponse.json({
      lists: rows.map((list) => ({
        ...list,
        items: items
          .filter((item) => item.listId === list.id)
          .map(({ movieId, position, note }) => ({ movieId, position, note })),
      })),
    });
  } catch (error) {
    console.error('[api/lists GET]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  let body: { title?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON { title }' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Нужно название' }, { status: 400 });

  try {
    const db = getDb();

    const [{ next } = { next: 0 }] = await db
      .select({ next: sql<number>`coalesce(max(${lists.position}), 0) + 1` })
      .from(lists);

    const [created] = await db
      .insert(lists)
      .values({
        title,
        description: typeof body.description === 'string' ? body.description : null,
        position: next,
      })
      .returning();

    return NextResponse.json({ list: { ...created, items: [] } }, { status: 201 });
  } catch (error) {
    console.error('[api/lists POST]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
