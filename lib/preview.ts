import type { Movie, NewMovie } from './db/schema';

/**
 * Предпросмотр результата TMDB до добавления (5.8): те же поля из API, что
 * у записи в базе, в той же форме (списки — JSON-строки), чтобы карточка
 * и поп-ап показывали их одними и теми же хелперами. Личных полей и
 * сведений о файле нет — записи ещё не существует.
 */
export type PreviewMovie = Pick<
  Movie,
  | 'kind'
  | 'tmdbId'
  | 'title'
  | 'originalTitle'
  | 'year'
  | 'posterUrl'
  | 'trailerKey'
  | 'overview'
  | 'runtime'
  | 'seasons'
  | 'episodes'
  | 'genres'
  | 'countries'
  | 'director'
  | 'producers'
  | 'cast'
  | 'ratingKp'
  | 'ratingImdb'
  | 'ratingTmdb'
>;

/** Ответ GET /api/search/preview. id — запись в коллекции, если уже добавлено. */
export type PreviewResponse = { movie: PreviewMovie; added: boolean; id: number | null };

/** Собранная для вставки запись (lib/merge) → поля предпросмотра. */
export function toPreview(record: NewMovie): PreviewMovie {
  return {
    kind: record.kind,
    tmdbId: record.tmdbId,
    title: record.title,
    originalTitle: record.originalTitle ?? null,
    year: record.year ?? null,
    posterUrl: record.posterUrl ?? null,
    trailerKey: record.trailerKey ?? null,
    overview: record.overview ?? null,
    runtime: record.runtime ?? null,
    seasons: record.seasons ?? null,
    episodes: record.episodes ?? null,
    genres: record.genres ?? null,
    countries: record.countries ?? null,
    director: record.director ?? null,
    producers: record.producers ?? null,
    cast: record.cast ?? null,
    ratingKp: record.ratingKp ?? null,
    ratingImdb: record.ratingImdb ?? null,
    ratingTmdb: record.ratingTmdb ?? null,
  };
}
