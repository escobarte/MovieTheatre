'use client';

import { HardDriveDownload, Plus, PlayCircle, RotateCw } from 'lucide-react';
import Link from 'next/link';

import { Carousel } from '@/components/Carousel';
import { GenreDoor } from '@/components/GenreDoor';
import { Shelf } from '@/components/Shelf';
import { useCollection } from '@/components/CollectionProvider';
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

      {/* Полка «Мои списки» появится вместе с API подборок на этапе 5.
          Пустая полка не отображается (5.2), поэтому её здесь просто нет. */}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="py-10 text-text-3">{text}</p>;
}

/** Третье пустое состояние (5.6): только приглашение, без полок и фильтров. */
function EmptyCollection() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <h1 className="text-[22px] font-bold">Коллекция пуста</h1>
      <p className="mt-2 max-w-[420px] text-text-2">
        Здесь появятся последние добавленные, полки и подборки. Начните с первого фильма.
      </p>
      <Link
        href="/dev"
        className="mt-6 inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
      >
        <Plus size={15} strokeWidth={1.5} />
        Добавить первый фильм
      </Link>
    </div>
  );
}
