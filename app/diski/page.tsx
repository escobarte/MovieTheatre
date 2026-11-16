'use client';

import { HardDrive, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useDisks, type Disk } from '@/components/DisksProvider';
import { formatGb, plural } from '@/lib/collection';

/**
 * Диски: метка, полоса заполнения, остаток и число фильмов. Полоса
 * нейтрального цвета — по 6.4 красный отдан действиям, а жёлтый оценке,
 * поэтому заполнение показывается ступенями --surface и текстом.
 */
export default function DisksPage() {
  const { disks, loading, error, createDisk } = useDisks();

  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [size, setSize] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim() || !Number(size)) return;

    const created = await createDisk(label.trim(), Number(size));
    if (created) {
      setLabel('');
      setSize('');
      setCreating(false);
    }
  }

  if (loading) return <p className="py-10 text-text-3">Загружаю диски</p>;

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h1 className="text-[22px] font-bold">Диски</h1>
        <span className="text-[12.5px] text-text-3">{disks.length}</span>
        <span className="flex-1" />
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            <Plus size={15} strokeWidth={1.5} />
            Новый диск
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-sm bg-surface p-3 text-text-2">Ошибка: {error}</p>}

      {creating && (
        <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Метка: A, B, H"
            className="w-[150px] rounded-md bg-surface px-3 py-2 caret-red outline-none"
          />
          <span className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
            <input
              type="number"
              min={1}
              step="1"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Объём"
              className="w-[110px] bg-transparent caret-red outline-none"
            />
            <span className="text-text-3">ГБ</span>
          </span>
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
              setLabel('');
              setSize('');
            }}
            className="rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface"
          >
            Отмена
          </button>
        </form>
      )}

      {disks.length === 0 && !creating && (
        <div className="flex flex-col items-center py-24 text-center">
          <HardDrive size={20} strokeWidth={1.5} className="text-icon-dim" />
          <p className="mt-3 text-[14px] font-medium">Дисков пока нет</p>
          <p className="mt-2 max-w-[420px] text-text-2">
            Заведите диск с меткой и объёмом — дальше у каждого скачанного фильма можно указать,
            где он лежит и сколько весит.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-6 inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            <Plus size={15} strokeWidth={1.5} />
            Завести первый диск
          </button>
        </div>
      )}

      {disks.length > 0 && (
        <div className="mt-5 flex flex-col gap-[var(--gap)]">
          {disks.map((disk) => (
            <DiskRow key={disk.id} disk={disk} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiskRow({ disk }: { disk: Disk }) {
  const share = disk.sizeGb > 0 ? Math.min(disk.usedGb / disk.sizeGb, 1) : 0;

  return (
    <Link
      href={`/diski/${disk.id}`}
      className="block rounded-sm bg-surface p-[13px] transition-colors duration-[120ms] hover:bg-surface-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-[15px] font-bold">
          <HardDrive size={16} strokeWidth={1.5} className="text-text-2" />
          Диск {disk.label}
        </span>
        <span className="text-[11.5px] text-text-3">
          {disk.movies} {plural(disk.movies, 'фильм', 'фильма', 'фильмов')}
        </span>
        <span className="flex-1" />
        <span className="text-[12px] text-text-2">
          {formatGb(disk.usedGb)} из {formatGb(disk.sizeGb)} ГБ
        </span>
      </div>

      <div className="mt-[9px] h-[6px] overflow-hidden rounded-pill bg-surface-3">
        <div className="h-full rounded-pill bg-text-2" style={{ width: `${share * 100}%` }} />
      </div>

      <div className="mt-[6px] flex flex-wrap items-baseline gap-x-3 text-[11.5px]">
        <span className="text-text-2">свободно {formatGb(disk.freeGb)} ГБ</span>
        {disk.moviesWithoutSize > 0 && (
          <span className="text-text-3">
            подсчёт неполный: {disk.moviesWithoutSize}{' '}
            {plural(disk.moviesWithoutSize, 'фильм', 'фильма', 'фильмов')} без веса
          </span>
        )}
      </div>
    </Link>
  );
}
