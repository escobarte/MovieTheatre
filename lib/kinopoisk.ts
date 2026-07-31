import 'server-only';

/**
 * Кинопоиск (poiskkino.dev) — единственный источник оценок КП и IMDb:
 * TMDB собственный рейтинг IMDb не отдаёт. Плюс точное русское название,
 * что критично для советского и старого кино.
 *
 * Бесплатный токен — 200 запросов в сутки. Запрос делается один раз при
 * добавлении. Если лимит исчерпан или сервис недоступен — запись всё равно
 * сохраняется без полей КП, это не ошибка (3.2).
 */

const BASE = 'https://api.poiskkino.dev/v1.4';

export type KpData = {
  kpId: number | null;
  title: string | null;
  ratingKp: number | null;
  ratingImdb: number | null;
  posterUrl: string | null;
};

type KpDoc = {
  id?: number;
  name?: string | null;
  alternativeName?: string | null;
  rating?: { kp?: number | null; imdb?: number | null } | null;
  poster?: { url?: string | null } | null;
};

/**
 * Возвращает null при любой неудаче: нет токена, лимит, таймаут, пустой ответ.
 * Вызывающая сторона обязана продолжить добавление без полей КП.
 */
export async function fetchByImdbId(imdbId: string): Promise<KpData | null> {
  const token = process.env.KINOPOISK_TOKEN;
  if (!token) {
    console.warn('[kp] KINOPOISK_TOKEN не задан — оценки КП и IMDb останутся пустыми');
    return null;
  }

  const url = new URL(`${BASE}/movie`);
  url.searchParams.set('externalId.imdb', imdbId);

  try {
    const res = await fetch(url, {
      headers: { 'X-API-KEY': token, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.warn(`[kp] ${imdbId} → ${res.status} ${res.statusText}, продолжаем без КП`);
      return null;
    }

    const body = (await res.json()) as { docs?: KpDoc[] };
    const doc = body.docs?.[0];
    if (!doc) return null;

    return {
      kpId: doc.id ?? null,
      title: doc.name || doc.alternativeName || null,
      ratingKp: positive(doc.rating?.kp),
      ratingImdb: positive(doc.rating?.imdb),
      posterUrl: doc.poster?.url ?? null,
    };
  } catch (error) {
    console.warn(`[kp] ${imdbId} недоступен, продолжаем без КП:`, (error as Error).message);
    return null;
  }
}

/** Кинопоиск отдаёт 0 вместо отсутствующей оценки — это не рейтинг. */
function positive(value?: number | null): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}
