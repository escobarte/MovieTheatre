'use client';

import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useCollection } from '@/components/CollectionProvider';
import { ListCover, ViewCover } from '@/components/ListCover';
import { useLists, type MovieList, type SavedView } from '@/components/ListsProvider';
import { entriesWord } from '@/lib/collection';
import type { Entry } from '@/lib/collection';
import { activeConditions, applyFilters, parseFilters } from '@/lib/filters';

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
            className="field min-w-[220px] flex-1"
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
        <div className="mt-5 grid grid-cols-2 gap-[var(--gap)] min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
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

          <div className="mt-3 grid grid-cols-2 gap-[var(--gap)] min-[900px]:grid-cols-3 min-[1280px]:grid-cols-4">
            {views.map((view) => (
              <ViewCard
                key={view.id}
                view={view}
                entries={entries}
                onDelete={() => deleteView(view.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ListCard({ list, byId }: { list: MovieList; byId: Map<number, Entry> }) {
  return (
    <Link href={`/spiski/${list.id}`} className="block">
      <div className="transition-transform duration-150 ease-out hover:scale-[1.03]">
        <ListCover list={list} byId={byId} />
      </div>

      <h3 className="mt-[9px] line-clamp-1 text-[15px] font-bold">{list.title}</h3>
      <p className="mt-1 text-[12px] text-text-3">
        {list.items.length} {entriesWord(list.items.length)} · вручную
      </p>
    </Link>
  );
}

/**
 * Карточка сохранённого фильтра: та же обложка-кадр, что у списка, плюс
 * условия фильтра и живой счётчик. Корзина — отдельный элемент рядом со
 * значком обновления, не внутри ссылки: кнопку нельзя вкладывать в `<a>`.
 */
function ViewCard({
  view,
  entries,
  onDelete,
}: {
  view: SavedView;
  entries: Entry[];
  onDelete: () => void;
}) {
  const filters = parseFilters(new URLSearchParams(view.query));
  const matches = applyFilters(entries, filters);
  const conditions = activeConditions(filters);

  return (
    <div className="group relative">
      <Link href={`/vse-kino?${view.query}`} className="block">
        <div className="transition-transform duration-150 ease-out hover:scale-[1.03]">
          <ViewCover posterUrls={matches.slice(0, 3).map((entry) => entry.posterUrl)} />
        </div>

        <h3 className="mt-[9px] line-clamp-1 text-[15px] font-bold">{view.title}</h3>
        {conditions.length > 0 && (
          <p className="mt-1 line-clamp-1 text-[12px] text-text-2">
            {conditions.slice(0, 3).join(' · ')}
            {conditions.length > 3 && ` +${conditions.length - 3}`}
          </p>
        )}
        <p className="mt-1 text-[12px] text-text-3">
          {matches.length} {entriesWord(matches.length)} · обновляется само
        </p>
      </Link>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Удалить фильтр «${view.title}»`}
        className="absolute top-[6px] right-[36px] z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full bg-bg text-text-2 opacity-0 transition-opacity duration-[120ms] hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Trash2 size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}
