'use client';

import { Image as ImageIcon, Star } from 'lucide-react';

import { posterRating, tvProgress, type Entry } from '@/lib/collection';

import { useCard } from './CardProvider';

/**
 * Постер 2:3 на подложке --surface-2. Пока изображения нет — иконка в
 * --icon-dim по центру, а не цветной прямоугольник (6.5, 6.9).
 * Клик открывает карточку записи (5.7).
 * Ширину задаёт родитель: 104px в полке, колонка сетки в каталоге.
 */
export function Poster({ entry, badge }: { entry: Entry; badge?: string }) {
  const { openCard } = useCard();
  const rating = posterRating(entry);
  const progress = entry.status === 'watching' ? tvProgress(entry) : null;

  return (
    <article>
      <button
        type="button"
        onClick={() => openCard(entry.id)}
        aria-label={`${entry.title}: открыть карточку`}
        className="block w-full text-left"
      >
        <div
          className={`relative aspect-[2/3] overflow-hidden rounded-xs bg-surface-2 transition-transform duration-150 ease-out hover:scale-[1.03] ${
            // Рамка постера со статусом «Буду смотреть» (6.4).
            entry.status === 'planned' ? 'outline outline-red -outline-offset-1' : ''
          }`}
        >
          {entry.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-icon-dim">
              <ImageIcon size={19} strokeWidth={1.5} />
            </span>
          )}

          {badge && (
            <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-text px-[6px] py-[3px] text-[11px] font-bold text-bg">
              {badge}
            </span>
          )}
        </div>

        {progress !== null && (
          <div className="mt-[6px] h-[3px] overflow-hidden rounded-pill bg-surface-3">
            <div
              className="h-full rounded-pill bg-st-watching"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        <h3 className="mt-[9px] line-clamp-2 text-[12.5px] font-medium">{entry.title}</h3>
      </button>

      <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
        <span className="text-text-3">{entry.year ?? '—'}</span>
        {rating && (
          <span className="flex items-center gap-[4px]">
            <Star size={11} strokeWidth={1.5} className="fill-gold text-gold" />
            <span className="text-gold">{rating.value}</span>
            <span className="text-text-3">{rating.own ? 'моя' : 'КП'}</span>
          </span>
        )}
      </div>
    </article>
  );
}
