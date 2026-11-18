'use client';

import { HardDriveDownload, List, Plus, PlayCircle, RotateCw } from 'lucide-react';
import Link from 'next/link';

import { Carousel } from '@/components/Carousel';
import { GenreDoor } from '@/components/GenreDoor';
import { ListCover, ViewCover } from '@/components/ListCover';
import { Shelf } from '@/components/Shelf';
import { useCollection } from '@/components/CollectionProvider';
import { useLists } from '@/components/ListsProvider';
import { useSearch } from '@/components/SearchProvider';
import { entriesWord } from '@/lib/collection';
import { activeConditions, applyFilters, parseFilters } from '@/lib/filters';
import { QP, catalogHref } from '@/lib/query';

const RECENT = 12;

export default function HomePage() {
  const { entries, loading, error } = useCollection();

  if (loading) return <Notice text="Загружаю коллекцию" />;
  if (error) return <Notice text={`Коллекция не загрузилась: ${error}`} />;
  if (entries.length === 0) return <EmptyCollection />;

  const recent = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, RECENT);

  const watching = entries.filter((e) => e.kind === 'tv' && e.status === 'watching');
  const rewatch = entries.filter((e) => e.rewatch === 1);
  const readyToWatch = entries.filter((e) => e.status === 'planned' && e.fileStatus === 'have');

  return (
    <div className="pb-16">
      <Carousel entries={recent} />

      <GenreDoor entries={entries} />

      <Shelf
        icon={PlayCircle}
        title="Смотрю сейчас"
        entries={watching}
        href={catalogHref({ [QP.type]: 'tv', [QP.status]: 'watching' })}
        badge={(e) =>
          e.progressSeason && e.progressEpisode
            ? `S${e.progressSeason} · E${e.progressEpisode}`
            : undefined
        }
      />

      <Shelf
        icon={RotateCw}
        title="Хочу пересмотреть"
        entries={rewatch}
        href={catalogHref({ [QP.rewatch]: '1' })}
      />

      <Shelf
        icon={HardDriveDownload}
        title="Буду смотреть, уже скачано"
        entries={readyToWatch}
        href={catalogHref({ [QP.status]: 'planned', [QP.file]: 'have' })}
      />

      <MyLists />
    </div>
  );
}

/**
 * Полка «Мои списки» (5.2): карточки подборок с числом записей и пометкой
 * «вручную» или «обновляется само». Пустая полка не отображается.
 */
function MyLists() {
  const { lists, views } = useLists();
  const { entries } = useCollection();
  if (lists.length === 0 && views.length === 0) return null;

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return (
    <section className="mt-[26px]">
      <div className="flex items-center gap-[10px]">
        <List size={18} strokeWidth={1.5} className="shrink-0 text-red" />
        <h2 className="text-[17px] font-bold">Мои списки</h2>
        <span className="rounded-pill bg-surface-2 px-[8px] py-[2px] text-[11.5px] text-text-2">
          {lists.length + views.length}
        </span>
        <span className="h-px flex-1 bg-line" />
        <Link href="/spiski" className="shrink-0 text-[12.5px] text-text-2 transition-colors duration-[120ms] hover:text-text">
          Все →
        </Link>
      </div>

      {lists.length > 0 && (
        <div className="mt-[13px] flex gap-[var(--gap)] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {lists.map((list) => (
            <Link key={list.id} href={`/spiski/${list.id}`} className="w-[240px] shrink-0">
              <div className="transition-transform duration-150 ease-out hover:scale-[1.03]">
                <ListCover list={list} byId={byId} />
              </div>
              <h3 className="mt-[9px] line-clamp-1 text-[15px] font-bold">{list.title}</h3>
              <p className="mt-1 text-[12px] text-text-3">
                {list.items.length} {entriesWord(list.items.length)} · вручную
              </p>
            </Link>
          ))}
        </div>
      )}

      {views.length > 0 && (
        <div
          className={`flex gap-[var(--gap)] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            lists.length > 0 ? 'mt-3' : 'mt-[13px]'
          }`}
        >
          {views.map((view) => {
            const filters = parseFilters(new URLSearchParams(view.query));
            const matches = applyFilters(entries, filters);
            const conditions = activeConditions(filters);

            return (
              <Link key={`view-${view.id}`} href={`/vse-kino?${view.query}`} className="w-[240px] shrink-0">
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
            );
          })}
        </div>
      )}
    </section>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="py-10 text-text-3">{text}</p>;
}

/** Третье пустое состояние (5.6): только приглашение, без полок и фильтров. */
function EmptyCollection() {
  const { openSearch } = useSearch();

  return (
    <div className="flex flex-col items-center py-24 text-center">
      <h1 className="text-[22px] font-bold">Коллекция пуста</h1>
      <p className="mt-2 max-w-[420px] text-text-2">
        Здесь появятся последние добавленные, полки и подборки. Начните с первого фильма.
      </p>
      <button
        type="button"
        onClick={() => openSearch('add')}
        className="mt-6 inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
      >
        <Plus size={15} strokeWidth={1.5} />
        Добавить первый фильм
      </button>
    </div>
  );
}
