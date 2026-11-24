import 'server-only';

import type { Kind } from './db/schema';
import type { Credit, Department, PersonHit } from './person';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export const POSTER_URL = (path: string) => `${IMG}/w500${path}`;
export const PROFILE_URL = (path: string) => `${IMG}/w185${path}`;
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

/* ─── Жанры сериалов ─────────────────────────────────────────────────── */

/**
 * TMDB отдаёт сериалам сборные жанры одной строкой — раскладываем на
 * отдельные, в том же написании, что у жанров фильмов (правка п.9).
 * Сравнение без учёта регистра, ключевыми словами — точную пунктуацию
 * TMDB для этих названий лучше не держать жёстко зашитой.
 */
const COMBINED_TV_GENRES: { test: (lower: string) => boolean; split: string[] }[] = [
  { test: (g) => g.includes('боевик') && g.includes('приключ'), split: ['боевик', 'приключения'] },
  {
    test: (g) => (g.includes('фантаст') || g.includes('нф')) && g.includes('фэнтези'),
    split: ['фантастика', 'фэнтези'],
  },
  { test: (g) => g.includes('войн') && g.includes('политик'), split: ['военный'] },
];

export function splitTvGenres(names: string[]): string[] {
  const out: string[] = [];

  for (const name of names) {
    const rule = COMBINED_TV_GENRES.find((r) => r.test(name.toLowerCase()));
    out.push(...(rule ? rule.split : [name]));
  }

  return dedupe(out);
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

/* ─── Люди ───────────────────────────────────────────────────────────── */

type PersonRaw = {
  id: number;
  name?: string;
  profile_path?: string | null;
  known_for_department?: string;
};

function toHit(p: PersonRaw): PersonHit {
  const dep = p.known_for_department;
  const department: Department =
    dep === 'Acting' ? 'actor' : dep === 'Directing' ? 'director' : 'other';
  return {
    id: p.id,
    name: p.name ?? '',
    photoUrl: p.profile_path ? PROFILE_URL(p.profile_path) : null,
    department,
  };
}

/** /search/person, ru-RU: до трёх человек. Никаких дополнительных запросов. */
export async function searchPeople(query: string, limit = 3): Promise<PersonHit[]> {
  const data = await tmdb<{ results?: PersonRaw[] }>('/search/person', {
    query,
    include_adult: 'false',
  });
  return (data.results ?? [])
    .filter((p) => p.name)
    .slice(0, limit)
    .map(toHit);
}

type CreditRaw = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
  genre_ids?: number[];
  character?: string;
  job?: string;
  episode_count?: number;
};

/** Жанры TMDB: документальное, новости, реалити, ток-шоу. */
const GENRE_DOC = 99;
const GENRES_TV_NOISE = [10763, 10764, 10767];
/** Минимум серий, чтобы работа в сериале не считалась эпизодической. */
const MIN_EPISODES = 3;

const SELF_ROLE = /(^|[^\p{L}])(self|himself|herself|themselves|себя|сам|сама|сами)([^\p{L}]|$)/iu;
const CEREMONY =
  /(academy awards|oscars?|golden globe|emmy|bafta|grammy|mtv|церемони|премия|премии|оскар|золотой глобус)/i;

/**
 * Фильмография одного человека: /person/{id} с combined_credits, ru-RU.
 * Отсеивается шум: без постера или года, документальное, ток-шоу, новости,
 * реалити, «самого себя» и церемонии, эпизодические роли в сериалах (меньше
 * трёх серий), повторы одной работы в нескольких ролях. Сортировка — по
 * популярности, при равенстве новее выше. Режиссёру — только job = Director.
 * Кинопоиск не трогается.
 */
export async function getPersonCredits(
  id: number,
): Promise<{ person: PersonHit; actor: Credit[]; director: Credit[] }> {
  const data = await tmdb<
    PersonRaw & { combined_credits?: { cast?: CreditRaw[]; crew?: CreditRaw[] } }
  >(`/person/${id}`, { append_to_response: 'combined_credits' });

  const credits = data.combined_credits ?? {};

  const actor = build(
    (credits.cast ?? []).filter((c) => !isNoise(c, true)),
  );
  const director = build((credits.crew ?? []).filter((c) => c.job === 'Director' && !isNoise(c, false)));

  return { person: toHit(data), actor, director };
}

function isNoise(c: CreditRaw, asActor: boolean): boolean {
  if (c.media_type !== 'movie' && c.media_type !== 'tv') return true;
  const genres = c.genre_ids ?? [];
  const tv = c.media_type === 'tv';
  const date = tv ? c.first_air_date : c.release_date;

  if (!c.poster_path || !yearOf(date)) return true;
  if (tv && c.episode_count !== undefined && c.episode_count < MIN_EPISODES) return true;
  if (genres.some((g) => GENRES_TV_NOISE.includes(g))) return true;

  if (asActor) {
    if (genres.includes(GENRE_DOC)) return true;
    if (c.character && SELF_ROLE.test(c.character)) {
      // «Он сам» в художественном кино бывает (камео) — оставляем; в сериалах
      // и на церемониях это гостевое появление.
      const title = (tv ? c.name : c.title) ?? '';
      if (tv || CEREMONY.test(title)) return true;
    }
  }
  return false;
}

function build(raw: CreditRaw[]): Credit[] {
  const byKey = new Map<string, { credit: Credit; popularity: number }>();

  for (const c of raw) {
    const kind: Kind = c.media_type === 'tv' ? 'tv' : 'movie';
    const key = `${kind}-${c.id}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      popularity: c.popularity ?? 0,
      credit: {
        tmdbId: c.id,
        kind,
        title: (kind === 'tv' ? c.name : c.title) ?? c.original_name ?? c.original_title ?? '',
        originalTitle: (kind === 'tv' ? c.original_name : c.original_title) ?? null,
        year: yearOf(kind === 'tv' ? c.first_air_date : c.release_date),
        posterUrl: c.poster_path ? POSTER_MINI_URL(c.poster_path) : null,
        director: null,
      },
    });
  }

  return [...byKey.values()]
    .sort((a, b) => b.popularity - a.popularity || (b.credit.year ?? 0) - (a.credit.year ?? 0))
    .map((x) => x.credit)
    .slice(0, 300);
}
