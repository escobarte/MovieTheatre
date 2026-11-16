import { countBy, decadeOf, type Entry } from './collection';

/**
 * Вся статистика (5.10) считается в памяти по уже загруженной коллекции —
 * новых запросов не делается.
 */

/** Часы: у фильма хронометраж целиком, у сериала минуты в серии на число серий. */
export function minutesOf(entry: Entry): number {
  if (entry.runtime === null) return 0;
  if (entry.kind === 'tv') return entry.runtime * (entry.episodes ?? 0);
  return entry.runtime;
}

export function totals(entries: Entry[]) {
  const movies = entries.filter((e) => e.kind === 'movie');
  const series = entries.filter((e) => e.kind === 'tv');

  const hours = (list: Entry[]) => Math.round(list.reduce((sum, e) => sum + minutesOf(e), 0) / 60);

  return {
    all: { count: entries.length, hours: hours(entries) },
    movies: { count: movies.length, hours: hours(movies) },
    series: { count: series.length, hours: hours(series) },
    /** Сериалы без числа серий занижают счётчик часов — про это надо сказать. */
    seriesWithoutEpisodes: series.filter((e) => e.runtime !== null && !e.episodes).length,
    withoutRuntime: entries.filter((e) => e.runtime === null).length,
  };
}

/** Гистограмма личных оценок: всегда все десять столбцов, включая нулевые. */
export function ratingHistogram(entries: Entry[]): { value: number; count: number }[] {
  return Array.from({ length: 10 }, (_, index) => ({
    value: index + 1,
    count: entries.filter((entry) => entry.rating === index + 1).length,
  }));
}

export function byDecade(entries: Entry[]): { decade: number; count: number }[] {
  const counts = new Map<number, number>();

  for (const entry of entries) {
    const decade = decadeOf(entry.year);
    if (decade === null) continue;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }

  return [...counts].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ decade, count }));
}

export function topDirectors(entries: Entry[], limit = 8) {
  return countBy(entries, (e) => (e.director ? [e.director] : [])).slice(0, limit);
}

export function topGenres(entries: Entry[], limit = 8) {
  return countBy(entries, (e) => e.genres).slice(0, limit);
}

export function topCountries(entries: Entry[], limit = 8) {
  return countBy(entries, (e) => e.countries).slice(0, limit);
}

/**
 * Расхождение с оценкой КП — единственная метрика здесь, которая говорит
 * о вкусе, а не о количестве. Считается только там, где есть и своя оценка,
 * и оценка КП; порог отсекает шум в полбалла.
 */
export type Divergence = { entry: Entry; diff: number };

export function divergence(entries: Entry[], threshold = 1.5, limit = 6) {
  const scored: Divergence[] = entries
    .filter((entry) => entry.rating !== null && entry.ratingKp !== null)
    .map((entry) => ({
      entry,
      diff: Math.round(((entry.rating as number) - (entry.ratingKp as number)) * 10) / 10,
    }));

  return {
    /** Где я щедрее КП. */
    higher: scored
      .filter((d) => d.diff >= threshold)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, limit),
    /** Где я строже. */
    lower: scored
      .filter((d) => d.diff <= -threshold)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, limit),
    compared: scored.length,
  };
}
