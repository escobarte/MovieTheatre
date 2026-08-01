'use client';

import { Image as ImageIcon, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useCollection } from '@/components/CollectionProvider';
import { useLists, type MovieList } from '@/components/ListsProvider';
import { entriesWord } from '@/lib/collection';
import type { Entry } from '@/lib/collection';

/**
 * Списки (5.9): сетка обложек с названием, числом записей и пометкой
 * происхождения. Сохранённые фильтры показываются там же отдельной группой
 * с пометкой, что состав обновляется сам.
 */
export default function ListsPage() {
  const { entries } = useCollection();
  const { lists, views, loading, error, createList, deleteView } = useLists();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    await createList(title.trim());
    setTitle('');
    setCreating(false);
  }

  if (loading) return <p className="py-10 text-text-3">Загружаю подборки</p>;

  const nothing = lists.length === 0 && views.length === 0;

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h1 className="text-[22px] font-bold">Списки</h1>
        <span className="flex-1" />
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            <Plus size={15} strokeWidth={1.5} />
            Новый список
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-sm bg-surface p-3 text-text-2">Ошибка: {error}</p>}

      {creating && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название подборки"
            className="min-w-[220px] flex-1 rounded-md bg-surface px-3 py-2 caret-red outline-none"
          />
          <button
            type="submit"
            className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            Создать
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setTitle('');
            }}
            className="rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface"
          >
            Отмена
          </button>
        </form>
      )}

      {nothing && !creating && (
        <div className="py-24 text-center">
          <p className="text-[14px] font-medium">Подборок пока нет</p>
          <p className="mt-2 text-text-2">
            Список собирается вручную и держит порядок. Сохранённый фильтр — именованное
            условие, его состав пополняется сам.
          </p>
        </div>
      )}

      {lists.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} byId={byId} />
          ))}
        </div>
      )}

      {views.length > 0 && (
        <section className="mt-8 border-t border-line pt-[18px]">
          <h2 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
            Сохранённые фильтры
          </h2>

          <div className="mt-3 grid grid-cols-1 gap-[var(--gap)] min-[600px]:grid-cols-2 min-[900px]:grid-cols-3">
            {views.map((view) => (
              <div
                key={view.id}
                className="flex items-center gap-3 rounded-sm bg-surface px-[13px] py-[11px]"
              >
                <Link href={`/vse-kino?${view.query}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{view.title}</span>
                  <span className="mt-1 flex items-center gap-[5px] text-[11.5px] text-text-3">
                    <RefreshCw size={12} strokeWidth={1.5} />
                    обновляется само
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteView(view.id)}
                  aria-label={`Удалить фильтр «${view.title}»`}
                  className="text-text-3 transition-colors duration-[120ms] hover:text-text"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ListCard({ list, byId }: { list: MovieList; byId: Map<number, Entry> }) {
  const cover =
    (list.coverMovieId ? byId.get(list.coverMovieId) : undefined) ??
    byId.get(list.items[0]?.movieId);

  return (
    <Link href={`/spiski/${list.id}`} className="block">
      <div className="aspect-[2/3] overflow-hidden rounded-xs bg-surface-2 transition-transform duration-150 ease-out hover:scale-[1.03]">
        {cover?.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-icon-dim">
            <ImageIcon size={19} strokeWidth={1.5} />
          </span>
        )}
      </div>

      <h3 className="mt-[9px] line-clamp-2 text-[12.5px] font-medium">{list.title}</h3>
      <p className="mt-1 text-[11.5px] text-text-3">
        {list.items.length} {entriesWord(list.items.length)} · вручную
      </p>
    </Link>
  );
}
