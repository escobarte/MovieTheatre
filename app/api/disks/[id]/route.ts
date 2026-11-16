import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { disks, movies } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

  let body: { label?: unknown; sizeGb?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ожидается JSON' }, { status: 400 });
  }

  const patch: { label?: string; sizeGb?: number; note?: string | null } = {};

  if (typeof body.label === 'string') {
    const label = body.label.trim();
    if (!label) return NextResponse.json({ error: 'Метка не может быть пустой' }, { status: 400 });
    patch.label = label;
  }

  if (body.sizeGb !== undefined) {
    const sizeGb = Number(body.sizeGb);
    if (!Number.isFinite(sizeGb) || sizeGb <= 0) {
      return NextResponse.json({ error: 'Объём должен быть больше нуля' }, { status: 400 });
    }
    patch.sizeGb = sizeGb;
  }

  if (body.note !== undefined) {
    patch.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Нет полей для изменения' }, { status: 400 });
  }

  try {
    const db = getDb();

    if (patch.label) {
      const [taken] = await db
        .select({ id: disks.id })
        .from(disks)
        .where(and(eq(disks.label, patch.label), ne(disks.id, id)))
        .limit(1);

      if (taken) {
        return NextResponse.json({ error: `Диск «${patch.label}» уже заведён` }, { status: 409 });
      }
    }

    const [saved] = await db.update(disks).set(patch).where(eq(disks.id, id)).returning();
    if (!saved) return NextResponse.json({ error: 'Диск не найден' }, { status: 404 });

    return NextResponse.json({ disk: saved });
  } catch (error) {
    console.error('[api/disks PATCH]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Удаление диска не трогает фильмы: у них только обнуляется diskId.
 * Запись о фильме переживает потерю носителя — это разные сущности.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Неверный id' }, { status: 400 });

  try {
    const db = getDb();

    const detached = await db
      .update(movies)
      .set({ diskId: null })
      .where(eq(movies.diskId, id))
      .returning({ id: movies.id });

    const [removed] = await db.delete(disks).where(eq(disks.id, id)).returning();
    if (!removed) return NextResponse.json({ error: 'Диск не найден' }, { status: 404 });

    return NextResponse.json({ ok: true, detached: detached.length });
  } catch (error) {
    console.error('[api/disks DELETE]', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
