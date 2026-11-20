import 'server-only';

import type { Kind, NewMovie } from './db/schema';
import { lookupByImdbId, type KpData, type KpLookup } from './kinopoisk';
import {
  BACKDROP_URL,
  POSTER_URL,
  getMovie,
  getTv,
  pickCast,
  pickMovieDirector,
  pickMovieProducers,
  pickTrailerKey,
  pickTvCreator,
  pickTvProducers,
  resolveCountries,
  splitTvGenres,
  yearOf,
} from './tmdb';

const json = (values: string[]) => JSON.stringify(values);

/**
 * Слияние по разделу 3.3. Рейтинги хранятся тремя отдельными числами
 * и не усредняются. Кинопоиск может не ответить — тогда его поля пустые,
 * а запись всё равно собирается. Не ответил TMDB — исключение.
 */
export async function buildRecord(tmdbId: number, kind: Kind): Promise<NewMovie> {
  return (await buildFromApi(tmdbId, kind)).record;
}

/**
 * То же плюс что вышло с Кинопоиском — для перезаполнения (2.2): kp.data
 * пусто, если КП не спрашивали (нет imdbId), не нашёл или не ответил;
 * kp.failed — только последнее.
 */
export type Built = { record: NewMovie; kp: KpLookup };

export async function buildFromApi(tmdbId: number, kind: Kind): Promise<Built> {
  return kind === 'tv' ? buildTv(tmdbId) : buildMovie(tmdbId);
}

const NOT_ASKED: KpLookup = { data: null, failed: false };

async function buildMovie(tmdbId: number): Promise<Built> {
  const tmdb = await getMovie(tmdbId);
  const imdbId = tmdb.imdb_id || null;
  const lookup = imdbId ? await lookupByImdbId(imdbId) : NOT_ASKED;
  const kp = lookup.data;

  const record: NewMovie = {
    kind: 'movie',
    tmdbId: tmdb.id,
    imdbId,
    kpId: kp?.kpId ?? null,

    title: title(kp, tmdb.title, tmdb.original_title),
    originalTitle: tmdb.original_title || null,
    year: yearOf(tmdb.release_date),
    posterUrl: poster(tmdb.poster_path, kp),
    backdropUrl: tmdb.backdrop_path ? BACKDROP_URL(tmdb.backdrop_path) : null,
    trailerKey: pickTrailerKey(tmdb.videos?.results),
    overview: tmdb.overview || null,
    runtime: tmdb.runtime || null,
    seasons: null,
    episodes: null,
    genres: json((tmdb.genres ?? []).map((g) => g.name)),
    countries: json(await resolveCountries(tmdb.production_countries)),
    director: pickMovieDirector(tmdb.credits?.crew),
    producers: json(pickMovieProducers(tmdb.credits?.crew)),
    cast: json(pickCast(tmdb.credits?.cast)),

    ratingKp: kp?.ratingKp ?? null,
    ratingImdb: kp?.ratingImdb ?? null,
    ratingTmdb: tmdb.vote_average || null,

    status: 'none',
  };

  return { record, kp: lookup };
}

async function buildTv(tmdbId: number): Promise<Built> {
  const tmdb = await getTv(tmdbId);
  const imdbId = tmdb.external_ids?.imdb_id || null;
  const lookup = imdbId ? await lookupByImdbId(imdbId) : NOT_ASKED;
  const kp = lookup.data;

  const record: NewMovie = {
    kind: 'tv',
    tmdbId: tmdb.id,
    imdbId,
    kpId: kp?.kpId ?? null,

    title: title(kp, tmdb.name, tmdb.original_name),
    originalTitle: tmdb.original_name || null,
    year: yearOf(tmdb.first_air_date),
    posterUrl: poster(tmdb.poster_path, kp),
    backdropUrl: tmdb.backdrop_path ? BACKDROP_URL(tmdb.backdrop_path) : null,
    trailerKey: pickTrailerKey(tmdb.videos?.results),
    overview: tmdb.overview || null,
    // Хронометраж серии. episode_run_time часто пустой — тогда берём
    // длительность последней вышедшей серии.
    runtime: tmdb.episode_run_time?.[0] || tmdb.last_episode_to_air?.runtime || null,
    seasons: tmdb.number_of_seasons ?? null,
    episodes: tmdb.number_of_episodes ?? null,
    // TMDB отдаёт сериалам сборные жанры («Боевик и Приключения») — раскладываем (п.9).
    genres: json(splitTvGenres((tmdb.genres ?? []).map((g) => g.name))),
    countries: json(await resolveCountries(tmdb.production_countries)),
    director: pickTvCreator(tmdb.created_by), // у сериала — создатель
    producers: json(pickTvProducers(tmdb.aggregate_credits?.crew)),
    cast: json(pickCast(tmdb.aggregate_credits?.cast)),

    ratingKp: kp?.ratingKp ?? null,
    ratingImdb: kp?.ratingImdb ?? null,
    ratingTmdb: tmdb.vote_average || null,

    status: 'none',
  };

  return { record, kp: lookup };
}

/** kp.name → tmdb.title(ru) → tmdb.original_title */
function title(kp: KpData | null, ru?: string | null, original?: string | null): string {
  return kp?.title || ru || original || 'Без названия';
}

/** TMDB, при отсутствии — КП. */
function poster(path: string | null | undefined, kp: KpData | null): string | null {
  return path ? POSTER_URL(path) : (kp?.posterUrl ?? null);
}
