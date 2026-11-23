import { Image as ImageIcon, Play, Star } from 'lucide-react';

import { plural } from '@/lib/collection';
import type { Movie } from '@/lib/db/schema';

/**
 * Общие кусочки обычного режима карточки (5.7). Ими же рисуется поп-ап
 * предпросмотра в поиске (5.8) — так набор полей, порядок и форматирование
 * у них одинаковые.
 */

/** Постер 2:3 и под ним светлая кнопка «Трейлер» (6.5), если ролик известен. */
export function PosterColumn({
  posterUrl,
  trailerKey,
}: {
  posterUrl: string | null;
  trailerKey: string | null;
}) {
  return (
    <div className="w-full max-w-[200px] shrink-0 self-center sm:self-start">
      <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-xs bg-surface-2 text-icon-dim">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={22} strokeWidth={1.5} />
        )}
      </div>

      {trailerKey && (
        <a
          href={`https://www.youtube.com/watch?v=${trailerKey}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-[7px] rounded-pill bg-text px-[18px] py-[9px] text-[12.5px] font-medium text-bg transition-colors duration-[120ms] hover:bg-white"
        >
          <Play size={15} strokeWidth={1.5} />
          Трейлер
        </a>
      )}
    </div>
  );
}

/** Три рейтинга рядом одинаковым набором: КП, IMDb, TMDB. */
export function Ratings({
  movie,
}: {
  movie: Pick<Movie, 'ratingKp' | 'ratingImdb' | 'ratingTmdb'>;
}) {
  return (
    <div className="mt-4 flex items-center gap-4">
      <Star size={14} strokeWidth={1.5} className="shrink-0 fill-gold text-gold" />
      <Rating label="КП" value={movie.ratingKp} />
      <Rating label="IMDb" value={movie.ratingImdb} />
      <Rating label="TMDB" value={movie.ratingTmdb} />
    </div>
  );
}

function Rating({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="flex items-baseline gap-[5px] text-[12px]">
      <span className="text-text-3">{label}</span>
      <span className={value === null ? 'text-text-4' : 'text-gold'}>
        {value === null ? '—' : value.toFixed(1)}
      </span>
    </span>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <dt className="w-[120px] shrink-0 pt-[3px] text-[11.5px] text-text-3">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/** Строки состава в порядке карточки — после режиссёра. */
export const CAST_ROWS = [
  { field: 'producers', label: 'Продюсеры' },
  { field: 'cast', label: 'В ролях' },
  { field: 'genres', label: 'Жанры' },
  { field: 'countries', label: 'Страна' },
] as const;

export function fromJson(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Значение строки в обычном режиме; пустое — «—». */
export function text(value: string | null | undefined): React.ReactNode {
  return value ? value : <span className="text-text-3">—</span>;
}

export function list(value: string | null): React.ReactNode {
  return text(fromJson(value).join(', '));
}

/** «8 сезонов, 73 серии, ~55 мин серия» — что известно. */
export function tvVolume(movie: Pick<Movie, 'seasons' | 'episodes' | 'runtime'>): string | null {
  const parts = [
    movie.seasons !== null && `${movie.seasons} ${plural(movie.seasons, 'сезон', 'сезона', 'сезонов')}`,
    movie.episodes !== null && `${movie.episodes} ${plural(movie.episodes, 'серия', 'серии', 'серий')}`,
    movie.runtime !== null && `~${movie.runtime} мин серия`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
