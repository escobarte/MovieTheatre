'use client';

import { ListVideo } from 'lucide-react';

import type { Entry } from '@/lib/collection';

import type { MovieList } from './ListsProvider';

/**
 * Обложка списка (правка по ручной проверке, п.1): рамка 16:9, не постер 2:3
 * — список не один фильм. Приоритет: выбранная обложка (`coverMovieId`) с
 * кадром этого фильма, иначе первые три постера по порядку списка в ряд,
 * иначе — пустое состояние со своей иконкой.
 */
export function ListCover({ list, byId }: { list: MovieList; byId: Map<number, Entry> }) {
  const cover = list.coverMovieId ? byId.get(list.coverMovieId) : undefined;

  if (cover?.backdropUrl) {
    return (
      <div className="aspect-[16/9] overflow-hidden rounded-sm bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.backdropUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (list.items.length === 0) {
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-[6px] rounded-sm bg-surface-2 px-3 text-center">
        <ListVideo size={20} strokeWidth={1.5} className="text-icon-dim" />
        <span className="text-[12px] text-text-3">Пусто — добавь из карточки фильма</span>
      </div>
    );
  }

  const slots = list.items.slice(0, 3);

  return (
    <div className="flex aspect-[16/9] gap-[2px] overflow-hidden rounded-sm bg-surface-2">
      {[0, 1, 2].map((i) => {
        const posterUrl = slots[i] ? byId.get(slots[i].movieId)?.posterUrl : undefined;
        return (
          <div key={i} className="flex-1 overflow-hidden bg-surface-2">
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
          </div>
        );
      })}
    </div>
  );
}
