'use client';

import Link from 'next/link';

import { countBy, type Entry } from '@/lib/collection';
import { QP, catalogHref } from '@/lib/query';

/**
 * Граница между витриной и каталогом. Работает как дверь: клик по жанру
 * уводит на «Всё кино» с уже включённым фильтром. Первая пилюля «Всё кино»
 * активна, пока жанр не выбран. Над строкой поясняющая подпись — иначе
 * назначение неочевидно (5.2).
 */
export function GenreDoor({ entries, limit = 8 }: { entries: Entry[]; limit?: number }) {
  const genres = countBy(entries, (e) => e.genres).slice(0, limit);
  if (genres.length === 0) return null;

  return (
    <section className="mt-[26px] border-t border-line pt-[18px]">
      <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
        Выбери жанр — откроется каталог с этим фильтром
      </p>

      <div className="-mx-1 mt-[11px] flex gap-[6px] overflow-x-auto px-1 pb-1">
        <Link
          href="/vse-kino"
          className="rounded-pill bg-red px-[15px] py-[7px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover"
        >
          Всё кино
        </Link>

        {genres.map(([genre]) => (
          <Link
            key={genre}
            href={catalogHref({ [QP.genre]: genre })}
            className="rounded-pill px-[15px] py-[7px] whitespace-nowrap text-text-2 transition-colors duration-[120ms] hover:bg-surface hover:text-text"
          >
            {capitalize(genre)}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** TMDB отдаёт жанры строчными: «фантастика» → «Фантастика». */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
