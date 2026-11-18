'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { countBy, type Entry } from '@/lib/collection';
import { QP, catalogHref } from '@/lib/query';

/**
 * Граница между витриной и каталогом. Работает как дверь: клик по жанру
 * уводит на «Всё кино» с уже включённым фильтром. Первая пилюля «Всё кино»
 * активна, пока жанр не выбран. Над строкой поясняющая подпись — иначе
 * назначение неочевидно (5.2).
 *
 * Полоса прокрутки скрыта на всех ширинах — прокрутка свайпом и тачпадом
 * остаётся. На устройствах с мышью рядом с подписью появляются стрелки,
 * которые доводят строку до следующего экрана и прячутся, когда ряд
 * упёрся в этот край (правка п.4).
 */
export function GenreDoor({ entries, limit = 8 }: { entries: Entry[]; limit?: number }) {
  const genres = countBy(entries, (e) => e.genres).slice(0, limit);
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setCanLeft(node.scrollLeft > 4);
    setCanRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const node = scroller.current;
    if (!node) return;

    const ro = new ResizeObserver(updateEdges);
    ro.observe(node);
    return () => ro.disconnect();
  }, [updateEdges, genres.length]);

  if (genres.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollBy({ left: dir * node.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section className="mt-[26px] border-t border-line pt-[18px]">
      <div className="flex items-baseline gap-[10px]">
        <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
          Выбери жанр — откроется каталог с этим фильтром
        </p>
        <span className="flex-1" />
        {canLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Левее"
            className="hidden text-text-2 transition-colors duration-[120ms] hover:text-text [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
          >
            <ChevronLeft size={15} strokeWidth={1.5} />
          </button>
        )}
        {canRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Правее"
            className="hidden text-text-2 transition-colors duration-[120ms] hover:text-text [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
          >
            <ChevronRight size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={updateEdges}
        className="-mx-1 mt-[11px] flex gap-[6px] overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Link
          href="/vse-kino"
          className="rounded-pill border border-line-strong px-[15px] py-[7px] whitespace-nowrap text-text transition-colors duration-[120ms] hover:bg-surface-2 active:border-red active:bg-red active:font-medium active:text-white"
        >
          Всё кино
        </Link>

        {genres.map(([genre]) => (
          <Link
            key={genre}
            href={catalogHref({ [QP.genre]: genre })}
            className="rounded-pill border border-line-strong px-[15px] py-[7px] whitespace-nowrap text-text transition-colors duration-[120ms] hover:bg-surface-2 active:border-red active:bg-red active:font-medium active:text-white"
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
