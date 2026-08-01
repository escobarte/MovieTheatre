import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { listItems, lists } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const EDITABLE = new Set(['title', 'description', 'coverMovieId', 'position']);

/** Переименование, описание, обложка, порядок между списками. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

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
    const [saved] = await getDb().update(lists).set(patch).where(eq(lists.id, id)).returning();
    if (!saved) return NextResponse.json({ error: 'Список не найден' }, { status: 404 });

    return NextResponse.json({ list: saved });
  } catch (error) {
    console.error('[api/lists PATCH]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Состав чистится явно, а не каскадом: в SQLite внешние ключи включаются
 * прагмой на соединение, и полагаться на неё не стоит.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

  try {
    const db = getDb();
    await db.delete(listItems).where(eq(listItems.listId, id));

    const [removed] = await db.delete(lists).where(eq(lists.id, id)).returning();
    if (!removed) return NextResponse.json({ error: 'Список не найден' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/lists DELETE]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
