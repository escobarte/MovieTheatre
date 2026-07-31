'use client';

import { ChevronDown, Star } from 'lucide-react';

import { Poster } from '@/components/Poster';
import { useCollection } from '@/components/CollectionProvider';
import { countBy, entriesWord } from '@/lib/collection';

const TYPES = [
  { value: 'all', label: 'Всё' },
  { value: 'movie', label: 'Фильмы' },
  { value: 'tv', label: 'Сериалы' },
];

const SELECTORS = ['Статус', 'Десятилетие', 'Страна', 'Файл', 'Хранилище', 'Хронометраж'];

/**
 * Всё кино (5.3). На этом шаге экран собран, но фильтры ещё не включены —
 * логика отбора, счётчики и синхронизация с URL приходят следующим куском.
 */
export default function CatalogPage() {
  const { entries, loading, error } = useCollection();

  if (loading) return <p className="py-10 text-text-3">Загружаю коллекцию</p>;
  if (error) return <p className="py-10 text-text-3">Коллекция не загрузилась: {error}</p>;

  const genres = countBy(entries, (e) => e.genres).slice(0, 8);

  return (
    <div className="pb-16">
      <div className="flex items-center gap-[14px]">
        <h1 className="text-[22px] font-bold">Всё кино</h1>
        <span className="text-[12.5px] text-text-3">
          {entries.length} {entriesWord(entries.length)}
        </span>
        <span className="flex-1" />

        <div className="flex rounded-pill bg-surface p-[3px]">
          {TYPES.map((type) => (
            <span
              key={type.value}
              className={`rounded-pill px-[17px] py-[7px] text-[12.5px] ${
                type.value === 'all' ? 'bg-surface-3 font-medium text-text' : 'text-text-2'
              }`}
            >
              {type.label}
            </span>
          ))}
        </div>
      </div>

      <div className="-mx-1 mt-4 flex gap-[6px] overflow-x-auto px-1">
        {genres.map(([genre]) => (
          <span
            key={genre}
            className="rounded-pill px-[15px] py-[7px] whitespace-nowrap text-text-2"
          >
            {genre.charAt(0).toUpperCase() + genre.slice(1)}
          </span>
        ))}
      </div>

      <div className="mt-[11px] flex flex-wrap gap-[7px]">
        {SELECTORS.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-[6px] rounded-pill bg-surface px-[14px] py-[7px] text-[12px] whitespace-nowrap text-text-2"
          >
            {label}
            <ChevronDown size={13} strokeWidth={1.5} />
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-[14px]">
        <span className="text-[12.5px] text-text-2">
          <span className="font-medium text-text">{entries.length}</span> из {entries.length}
        </span>
        <span className="flex-1" />

        <span className="inline-flex items-center gap-[6px] rounded-pill bg-surface px-[14px] py-[7px] text-[12px] text-text-2">
          Сортировка: дата добавления
          <ChevronDown size={13} strokeWidth={1.5} />
        </span>

        <span className="flex items-center gap-2">
          <Star size={14} strokeWidth={1.5} className="fill-gold text-gold" />
          <span className="inline-block h-1 w-[72px] rounded-[2px] bg-surface-3" />
          <span className="text-[12px] text-text-2">любая</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-[var(--gap)] min-[600px]:grid-cols-3 min-[900px]:grid-cols-5 min-[1280px]:grid-cols-6">
        {entries.map((entry) => (
          <Poster key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
