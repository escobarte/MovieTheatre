'use client';

import { Image as ImageIcon } from 'lucide-react';

import { posterRating, type Entry } from '@/lib/collection';

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
            <span className="absolute right-1 bottom-1 rounded-xs bg-bg/85 px-[5px] py-[2px] text-[11px] font-medium text-text">
              {badge}
            </span>
          )}
        </div>

        <h3 className="mt-[9px] line-clamp-2 text-[12.5px] font-medium">{entry.title}</h3>
      </button>

      <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
        <span className="text-text-3">{entry.year ?? '—'}</span>
        {rating && <span className={rating.own ? 'text-gold' : 'text-text-3'}>{rating.value}</span>}
      </div>
    </article>
  );
}
