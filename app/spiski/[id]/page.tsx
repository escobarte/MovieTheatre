'use client';

import { ChevronLeft, ChevronRight, GripVertical, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

import { useCard } from '@/components/CardProvider';
import { useCollection } from '@/components/CollectionProvider';
import { useLists, type ListItem } from '@/components/ListsProvider';
import { entriesWord, posterRating, type Entry } from '@/lib/collection';
import { Image as PosterIcon } from 'lucide-react';

/**
 * Внутри списка — обычная сетка плюс перетаскивание для порядка и поле
 * «почему он здесь» у каждой записи (5.9). Порядок это смысловая часть
 * подборки, поэтому после каждого перемещения состав уходит одним PUT.
 */
export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const router = useRouter();

  const { entries } = useCollection();
  const { lists, loading, putItems, patchList, deleteList } = useLists();
  const { openCard } = useCard();

  const [dragging, setDragging] = useState<number | null>(null);

  const list = lists.find((l) => l.id === id);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  if (loading) return <p className="py-10 text-text-3">Загружаю подборку</p>;
  if (!list) return <p className="py-10 text-text-3">Такой подборки нет</p>;

  const items = [...list.items].sort((a, b) => a.position - b.position);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void putItems(id, next);
  };

  const setNote = (movieId: number, note: string) => {
    void putItems(
      id,
      items.map((item) => (item.movieId === movieId ? { ...item, note: note || null } : item)),
    );
  };

  const remove = (movieId: number) => {
    void putItems(
      id,
      items.filter((item) => item.movieId !== movieId),
    );
  };

  return (
    <div className="pb-16">
      <Link
        href="/spiski"
        className="inline-flex items-center gap-1 text-[12px] text-text-2 transition-colors duration-[120ms] hover:text-text"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Списки
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-[14px]">
        <input
          key={list.title}
          defaultValue={list.title}
          onBlur={(e) =>
            e.target.value.trim() &&
            e.target.value !== list.title &&
            patchList(id, { title: e.target.value.trim() })
          }
          className="min-w-0 flex-1 rounded-xs bg-transparent px-1 text-[22px] font-bold caret-red transition-colors duration-[120ms] hover:bg-surface focus:bg-surface"
        />
        <span className="text-[12.5px] text-text-3">
          {items.length} {entriesWord(items.length)}
        </span>
        <button
          type="button"
          onClick={async () => {
            await deleteList(id);
            router.push('/spiski');
          }}
          aria-label="Удалить подборку"
          className="text-text-3 transition-colors duration-[120ms] hover:text-text"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-20 text-center text-text-2">
          Пусто. Записи добавляются из карточки фильма — кнопка «В список».
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[1280px]:grid-cols-6">
          {items.map((item, index) => {
            const entry = byId.get(item.movieId);

            return (
              <div
                key={item.movieId}
                draggable
                onDragStart={() => setDragging(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragging !== null) move(dragging, index);
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
                className={dragging === index ? 'opacity-50' : ''}
              >
                <Card
                  entry={entry}
                  item={item}
                  position={index + 1}
                  onOpen={() => entry && openCard(entry.id)}
                  onMove={(delta) => move(index, index + delta)}
                  onNote={(note) => setNote(item.movieId, note)}
                  onRemove={() => remove(item.movieId)}
                  first={index === 0}
                  last={index === items.length - 1}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({
  entry,
  item,
  position,
  onOpen,
  onMove,
  onNote,
  onRemove,
  first,
  last,
}: {
  entry: Entry | undefined;
  item: ListItem;
  position: number;
  onOpen: () => void;
  onMove: (delta: number) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
}) {
  const rating = entry ? posterRating(entry) : null;

  return (
    <article>
      <button
        type="button"
        onClick={onOpen}
        aria-label={entry ? `${entry.title}: открыть карточку` : 'Запись удалена'}
        className="block w-full text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xs bg-surface-2 transition-transform duration-150 ease-out hover:scale-[1.03]">
          {entry?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-icon-dim">
              <PosterIcon size={19} strokeWidth={1.5} />
            </span>
          )}

          <span className="absolute top-1 left-1 rounded-xs bg-bg/85 px-[5px] py-[2px] text-[11px] font-medium">
            {position}
          </span>
        </div>

        <h3 className="mt-[9px] line-clamp-2 text-[12.5px] font-medium">
          {entry?.title ?? 'Запись удалена'}
        </h3>
      </button>

      <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
        <span className="text-text-3">{entry?.year ?? '—'}</span>
        {rating && <span className={rating.own ? 'text-gold' : 'text-text-3'}>{rating.value}</span>}
      </div>

      <input
        key={item.note ?? ''}
        defaultValue={item.note ?? ''}
        placeholder="почему он здесь"
        onBlur={(e) => e.target.value !== (item.note ?? '') && onNote(e.target.value.trim())}
        className="mt-[6px] w-full rounded-xs bg-transparent px-1 py-[2px] text-[11.5px] text-text-2 caret-red transition-colors duration-[120ms] hover:bg-surface focus:bg-surface"
      />

      <div className="mt-1 flex items-center gap-1 text-text-3">
        <GripVertical size={14} strokeWidth={1.5} className="cursor-grab" aria-hidden />
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label="Раньше"
          className="transition-colors duration-[120ms] hover:text-text disabled:text-icon-dim"
        >
          <ChevronLeft size={15} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label="Позже"
          className="transition-colors duration-[120ms] hover:text-text disabled:text-icon-dim"
        >
          <ChevronRight size={15} strokeWidth={1.5} />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Убрать из подборки"
          className="transition-colors duration-[120ms] hover:text-text"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}
