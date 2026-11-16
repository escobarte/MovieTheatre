import 'server-only';

import type { Kind } from './db/schema';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export const POSTER_URL = (path: string) => `${IMG}/w500${path}`;
export const POSTER_MINI_URL = (path: string) => `${IMG}/w154${path}`;
export const BACKDROP_URL = (path: string) => `${IMG}/w1280${path}`;

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY не задан');
  return key;
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', apiKey());
  url.searchParams.set('language', 'ru-RU');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`TMDB ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Формы ответов ──────────────────────────────────────────────────── */

type Video = { iso_639_1?: string; site?: string; type?: string; key?: string; official?: boolean };
type Person = { name: string };
type MovieCrew = { name: string; job: string };
type TvCrew = { name: string; jobs?: { job: string }[] };
type Named = { name: string };
type Country = { iso_3166_1: string; name: string };

export type TmdbMovie = {
  id: number;
  imdb_id?: string | null;
  title?: string;
  original_title?: string;
  overview?: string | null;
  release_date?: string;
  runtime?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: Named[];
  production_countries?: Country[];
  credits?: { cast?: Person[]; crew?: MovieCrew[] };
  videos?: { results?: Video[] };
};

export type TmdbTv = {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string | null;
  first_air_date?: string;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number | null } | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: Named[];
  production_countries?: Country[];
  origin_country?: string[];
  created_by?: Person[];
  aggregate_credits?: { cast?: Person[]; crew?: TvCrew[] };
  videos?: { results?: Video[] };
  external_ids?: { imdb_id?: string | null };
};

type SearchResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

/* ─── Запросы ────────────────────────────────────────────────────────── */

export function getMovie(tmdbId: number) {
  return tmdb<TmdbMovie>(`/movie/${tmdbId}`, { append_to_response: 'credits,videos' });
}

/** У сериала imdb_id лежит в external_ids, а не в корне — в отличие от фильма. */
export function getTv(tmdbId: number) {
  return tmdb<TmdbTv>(`/tv/${tmdbId}`, {
    append_to_response: 'aggregate_credits,videos,external_ids',
  });
}

export type Candidate = {
  tmdbId: number;
  kind: Kind;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  director: string | null;
};

/**
 * /search/multi отдаёт фильмы и сериалы вперемешку, различаются по media_type.
 * Персоны отбрасываются. Режиссёр докачивается отдельно — в выдаче поиска его нет,
 * а без него оригинал не отличить от ремейка (5.8).
 */
export async function searchMulti(query: string, limit = 8): Promise<Candidate[]> {
  const data = await tmdb<{ results?: SearchResult[] }>('/search/multi', {
    query,
    include_adult: 'false',
  });

  const found = (data.results ?? [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, limit);

  return Promise.all(
    found.map(async (r) => {
      const kind: Kind = r.media_type === 'tv' ? 'tv' : 'movie';
      const date = kind === 'tv' ? r.first_air_date : r.release_date;

      return {
        tmdbId: r.id,
        kind,
        title: (kind === 'tv' ? r.name : r.title) ?? r.original_name ?? r.original_title ?? '',
        originalTitle: (kind === 'tv' ? r.original_name : r.original_title) ?? null,
        year: yearOf(date),
        posterUrl: r.poster_path ? POSTER_MINI_URL(r.poster_path) : null,
        director: await directorOf(r.id, kind).catch(() => null),
      };
    }),
  );
}

async function directorOf(tmdbId: number, kind: Kind): Promise<string | null> {
  if (kind === 'tv') {
    const tv = await tmdb<{ created_by?: Person[] }>(`/tv/${tmdbId}`);
    return joinNames(tv.created_by);
  }
  const credits = await tmdb<{ crew?: MovieCrew[] }>(`/movie/${tmdbId}/credits`);
  return joinNames((credits.crew ?? []).filter((c) => c.job === 'Director'));
}

/* ─── Разбор ─────────────────────────────────────────────────────────── */

export function yearOf(date?: string | null): number | null {
  const year = Number(date?.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function joinNames(people?: { name: string }[] | null): string | null {
  const names = dedupe((people ?? []).map((p) => p.name));
  return names.length ? names.join(', ') : null;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Трейлер: только YouTube и только type='Trailer'. Предпочитается русская
 * озвучка, при её отсутствии английская, иначе первая подходящая. Хранится
 * один ключ ролика.
 */
export function pickTrailerKey(videos?: Video[] | null): string | null {
  const trailers = (videos ?? []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.key);
  const byLang = (lang: string) => trailers.find((v) => v.iso_639_1 === lang);
  return (byLang('ru') ?? byLang('en') ?? trailers[0])?.key ?? null;
}

/**
 * Продюсеры: строго job='Producer' и только первые двое. В крупных фильмах
 * в этой графе бывает 10–15 человек вместе с исполнительными и линейными.
 */
export function pickMovieProducers(crew?: MovieCrew[] | null): string[] {
  return dedupe((crew ?? []).filter((c) => c.job === 'Producer').map((c) => c.name)).slice(0, 2);
}

export function pickTvProducers(crew?: TvCrew[] | null): string[] {
  const names = (crew ?? [])
    .filter((c) => (c.jobs ?? []).some((j) => j.job === 'Producer'))
    .map((c) => c.name);
  return dedupe(names).slice(0, 2);
}

export function pickCast(cast?: Person[] | null): string[] {
  return dedupe((cast ?? []).map((c) => c.name)).slice(0, 4);
}

export function pickMovieDirector(crew?: MovieCrew[] | null): string | null {
  return joinNames((crew ?? []).filter((c) => c.job === 'Director'));
}

export function pickTvCreator(createdBy?: Person[] | null): string | null {
  return joinNames(createdBy);
}

/* ─── Страны ─────────────────────────────────────────────────────────── */

/** TMDB не переводит на русский ровно эти девять кодов — все исторические. */
const COUNTRY_OVERRIDES: Record<string, string> = {
  SU: 'СССР',
  XC: 'Чехословакия',
  XG: 'ГДР',
  YU: 'Югославия',
  CS: 'Сербия и Черногория',
  BU: 'Бирма',
  TP: 'Восточный Тимор',
  XI: 'Северная Ирландия',
  ZR: 'Заир',
};

let countryNames: Map<string, string> | undefined;

/**
 * production_countries приходят по-английски даже при language=ru-RU,
 * поэтому названия берутся из справочника TMDB по коду ISO. Справочник
 * запрашивается один раз на процесс.
 */
async function getCountryNames(): Promise<Map<string, string>> {
  if (countryNames) return countryNames;

  const list = await tmdb<{ iso_3166_1: string; english_name: string; native_name: string }[]>(
    '/configuration/countries',
  );

  countryNames = new Map(list.map((c) => [c.iso_3166_1, c.native_name || c.english_name]));
  return countryNames;
}

export async function resolveCountries(countries?: Country[] | null): Promise<string[]> {
  const codes = dedupe((countries ?? []).map((c) => c.iso_3166_1));
  if (!codes.length) return [];

  let names: Map<string, string>;
  try {
    names = await getCountryNames();
  } catch {
    names = new Map();
  }

  return codes.map(
    (code) =>
      COUNTRY_OVERRIDES[code] ??
      names.get(code) ??
      (countries ?? []).find((c) => c.iso_3166_1 === code)?.name ??
      code,
  );
}
