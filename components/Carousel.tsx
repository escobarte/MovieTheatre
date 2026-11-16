'use client';

import { ChevronLeft, ChevronRight, Image as ImageIcon, Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { STATUS_LABELS, addedLabel, type Entry } from '@/lib/collection';

import { useCard } from './CardProvider';

const GAP = 12;

/**
 * Карусель последних добавленных: три карточки в ряд, у каждой кадр 16:9,
 * дата добавления, название, год, режиссёр, оценка и текущий статус (5.2).
 * Листается стрелками, под ней точки; на телефоне — одна карточка и свайп,
 * поэтому лента прокручиваемая, а стрелки только доводят до следующей
 * страницы (6.7).
 */
export function Carousel({ entries }: { entries: Entry[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(3);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 900px)');
    const medium = window.matchMedia('(min-width: 600px)');

    const update = () => setPerPage(wide.matches ? 3 : medium.matches ? 2 : 1);
    update();

    wide.addEventListener('change', update);
    medium.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      medium.removeEventListener('change', update);
    };
  }, []);

  const pages = Math.ceil(entries.length / perPage);

  const goTo = useCallback((next: number) => {
    const node = scroller.current;
    if (!node) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollTo({ left: next * (node.clientWidth + GAP), behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    setPage(Math.round(node.scrollLeft / (node.clientWidth + GAP)));
  };

  const step = (delta: number) => {
    const next = Math.min(Math.max(page + delta, 0), pages - 1);
    setPage(next);
    goTo(next);
  };

  return (
    <section>
      <div className="flex items-baseline gap-[10px]">
        <h2 className="text-[17px] font-bold">Последние добавленные</h2>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={page === 0}
          aria-label="Предыдущие"
          className="text-text-2 transition-colors duration-[120ms] hover:text-text disabled:text-icon-dim"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={page >= pages - 1}
          aria-label="Следующие"
          className="text-text-2 transition-colors duration-[120ms] hover:text-text disabled:text-icon-dim"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="mt-3 flex snap-x snap-mandatory gap-[var(--gap)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="shrink-0 snap-start"
            style={{ width: `calc((100% - ${(perPage - 1) * GAP}px) / ${perPage})` }}
          >
            <Card entry={entry} />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-[14px] flex justify-center gap-[5px]">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setPage(index);
                goTo(index);
              }}
              aria-label={`Страница ${index + 1}`}
              aria-current={index === page ? 'true' : undefined}
              className={`h-[3px] rounded-[2px] transition-[width,background-color] duration-[120ms] ${
                index === page ? 'w-[18px] bg-red' : 'w-[6px] bg-surface-3'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ entry }: { entry: Entry }) {
  const { openCard } = useCard();
  const rating = entry.rating ?? entry.ratingKp;
  // По 5.2 в карточке год и режиссёр; у сериала в этом поле создатель.
  const meta = [entry.year, entry.director].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => openCard(entry.id)}
      aria-label={`${entry.title}: открыть карточку`}
      className="block w-full rounded-md bg-surface p-[10px] text-left"
    >
      <span className="flex aspect-[16/9] items-center justify-center rounded-sm bg-surface-2 text-icon-dim">
        <ImageIcon size={22} strokeWidth={1.5} />
      </span>

      <span className="mt-[11px] block text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
        {addedLabel(entry.createdAt)}
      </span>

      <span className="mt-[5px] line-clamp-1 block text-[15px] font-bold">{entry.title}</span>

      <span className="mt-1 line-clamp-1 block text-[11.5px] text-text-3">{meta || '—'}</span>

      <span className="mt-[9px] flex items-center gap-[6px] text-[11.5px]">
        {rating !== null && (
          <>
            <Star size={12} strokeWidth={1.5} className="fill-gold text-gold" />
            <span className="text-gold">{entry.rating ?? rating.toFixed(1)}</span>
            <span className="text-icon-dim">·</span>
          </>
        )}
        <span className="text-text-2">{statusLabel(entry)}</span>
      </span>
    </button>
  );
}

function statusLabel(entry: Entry): string {
  if (entry.kind === 'tv' && entry.progressSeason && entry.progressEpisode) {
    return `S${entry.progressSeason} · E${entry.progressEpisode}`;
  }
  return STATUS_LABELS[entry.status].toLowerCase();
}
