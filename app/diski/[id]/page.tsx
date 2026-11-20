'use client';

import { AlertCircle, ChevronLeft, HardDrive, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';

import { CardSequence } from '@/components/CardProvider';
import { useCollection } from '@/components/CollectionProvider';
import { useDisks } from '@/components/DisksProvider';
import { Poster } from '@/components/Poster';
import { formatGb, plural } from '@/lib/collection';
import { QP, catalogHref } from '@/lib/query';

/**
 * Содержимое диска: сетка постеров того, что на нём лежит. Клик по постеру
 * открывает карточку записи, как везде. Если у части фильмов вес не введён,
 * об этом сказано прямо — иначе остаток выглядел бы точным.
 */
export default function DiskPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const router = useRouter();

  const { entries } = useCollection();
  const { disks, loading, patchDisk, deleteDisk } = useDisks();

  const disk = disks.find((d) => d.id === id);

  if (loading) return <p className="py-10 text-text-3">Загружаю диск</p>;
  if (!disk) return <p className="py-10 text-text-3">Такого диска нет</p>;

  const onDisk = entries.filter((entry) => entry.diskId === id);
  const share = disk.sizeGb > 0 ? Math.min(disk.usedGb / disk.sizeGb, 1) : 0;

  return (
    <div className="pb-16">
      <Link
        href="/diski"
        className="inline-flex items-center gap-1 text-[12px] text-text-2 transition-colors duration-[120ms] hover:text-text"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Диски
      </Link>

      <div
        className="mt-2 rounded-lg border p-[20px]"
        style={{ background: 'var(--panel-sky)', borderColor: 'var(--panel-sky-line)' }}
      >
        <div className="flex flex-wrap items-center gap-[14px]">
          <h1 className="flex items-center gap-2 text-[22px] font-bold">
            <HardDrive size={20} strokeWidth={1.5} style={{ color: 'var(--sky)' }} />
            Диск
            <input
              key={disk.label}
              defaultValue={disk.label}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== disk.label &&
                patchDisk(id, { label: e.target.value.trim() })
              }
              className="field w-[90px]"
            />
          </h1>

          <span className="flex items-center gap-1 text-[12.5px] text-text-3">
            <input
              key={disk.sizeGb}
              type="number"
              min={1}
              defaultValue={disk.sizeGb}
              onBlur={(e) =>
                Number(e.target.value) > 0 &&
                Number(e.target.value) !== disk.sizeGb &&
                patchDisk(id, { sizeGb: Number(e.target.value) })
              }
              className="field w-[80px]"
            />
            ГБ всего
          </span>

          <span className="flex-1" />

          <Link
            href={catalogHref({ [QP.disk]: String(id) })}
            className="rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] font-medium transition-colors duration-[120ms] hover:bg-surface"
          >
            Открыть в каталоге
          </Link>

          <button
            type="button"
            onClick={async () => {
              await deleteDisk(id);
              router.push('/diski');
            }}
            aria-label="Удалить диск"
            className="text-text-3 transition-colors duration-[120ms] hover:text-text"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 h-[6px] overflow-hidden rounded-pill bg-surface-3">
          <div
            className="h-full rounded-pill"
            style={{ width: `${share * 100}%`, background: share >= 0.9 ? 'var(--orange)' : 'var(--sky)' }}
          />
        </div>

        <div className="mt-[6px] flex flex-wrap items-baseline gap-x-3 text-[11.5px]">
          <span className="text-text-2">
            занято {formatGb(disk.usedGb)} ГБ,{' '}
            <span className="font-medium text-text">свободно {formatGb(disk.freeGb)} ГБ</span>
          </span>
          <span className="text-text-3">
            {onDisk.length} {plural(onDisk.length, 'фильм', 'фильма', 'фильмов')}
          </span>
          {disk.moviesWithoutSize > 0 && (
            <span className="flex items-center gap-[4px] text-text-3">
              <AlertCircle size={13} strokeWidth={1.5} style={{ color: 'var(--orange)' }} />
              подсчёт неполный: {disk.moviesWithoutSize}{' '}
              {plural(disk.moviesWithoutSize, 'фильм', 'фильма', 'фильмов')} без веса
            </span>
          )}
        </div>
      </div>

      <input
        key={disk.note ?? ''}
        defaultValue={disk.note ?? ''}
        placeholder="пометка"
        onBlur={(e) =>
          e.target.value.trim() !== (disk.note ?? '') && patchDisk(id, { note: e.target.value.trim() })
        }
        className="field mt-3 w-full text-text-2"
      />

      {onDisk.length === 0 ? (
        <p className="py-20 text-center text-text-2">
          На диске пока ничего не отмечено. Диск выбирается в карточке фильма, блок «Файл».
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[1280px]:grid-cols-6">
          <CardSequence ids={onDisk.map((entry) => entry.id)}>
            {onDisk.map((entry) => (
              <div key={entry.id}>
                <Poster entry={entry} />
                <p className="mt-1 text-[11.5px] text-text-3">
                  {entry.sizeGb === null ? 'вес не указан' : `${formatGb(entry.sizeGb)} ГБ`}
                </p>
              </div>
            ))}
          </CardSequence>
        </div>
      )}
    </div>
  );
}
