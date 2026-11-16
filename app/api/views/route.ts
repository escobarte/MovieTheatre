import { asc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { savedViews } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Сохранённый фильтр — это имя плюс строка запроса из адресной строки (2.5).
 * Состав такой подборки обновляется сам по мере роста коллекции.
 */
export async function GET() {
  try {
    const views = await getDb()
      .select()
      .from(savedViews)
      .orderBy(asc(savedViews.position), asc(savedViews.id));

    return NextResponse.json({ views });
  } catch (error) {
    console.error('[api/views GET]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // TODO (этап 7): проверка cookie на мутирующих роутах.
  let body: { title?: unknown; query?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON { title, query }' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const query = typeof body.query === 'string' ? body.query.replace(/^\?/, '') : '';

  if (!title) return NextResponse.json({ error: 'Нужно название' }, { status: 400 });
  if (!query) return NextResponse.json({ error: 'Нечего сохранять: фильтры не выбраны' }, { status: 400 });

  try {
    const db = getDb();

    const [{ next } = { next: 0 }] = await db
      .select({ next: sql<number>`coalesce(max(${savedViews.position}), 0) + 1` })
      .from(savedViews);

    const [created] = await db
      .insert(savedViews)
      .values({ title, query, position: next })
      .returning();

    return NextResponse.json({ view: created }, { status: 201 });
  } catch (error) {
    console.error('[api/views POST]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

  try {
    const [removed] = await getDb().delete(savedViews).where(eq(savedViews.id, id)).returning();
    if (!removed) return NextResponse.json({ error: 'Фильтр не найден' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/views DELETE]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
