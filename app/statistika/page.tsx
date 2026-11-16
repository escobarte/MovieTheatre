'use client';

import { Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { useCard } from '@/components/CardProvider';
import { useCollection } from '@/components/CollectionProvider';
import { useDisks } from '@/components/DisksProvider';
import { entriesWord, formatGb, plural, type Entry } from '@/lib/collection';
import { QP, catalogHref } from '@/lib/query';
import {
  byDecade,
  divergence,
  ratingHistogram,
  topCountries,
  topDirectors,
  topGenres,
  totals,
  type Divergence,
} from '@/lib/stats';

/**
 * Статистика (5.10). Всё считается в памяти по уже загруженной коллекции.
 * Графики — полосы на ступенях --surface: по 6.4 красный отдан действиям,
 * а жёлтый только звезде рейтинга, поэтому данные показываются нейтрально.
 */
export default function StatsPage() {
  const { entries, loading, error } = useCollection();
  const { disks } = useDisks();

  const stats = useMemo(
    () => ({
      totals: totals(entries),
      ratings: ratingHistogram(entries),
      decades: byDecade(entries),
      directors: topDirectors(entries),
      genres: topGenres(entries),
      countries: topCountries(entries),
      divergence: divergence(entries),
    }),
    [entries],
  );

  if (loading) return <p className="py-10 text-text-3">Загружаю коллекцию</p>;
  if (error) return <p className="py-10 text-text-3">Коллекция не загрузилась: {error}</p>;

  if (entries.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-[22px] font-bold">Статистика</h1>
        <p className="mt-2 text-text-2">Считать пока нечего — коллекция пуста.</p>
      </div>
    );
  }

  const { totals: sum, ratings, decades, divergence: gap } = stats;
  const rated = entries.filter((e) => e.rating !== null).length;
  const downloaded = entries.filter((e) => e.fileStatus === 'have');

  return (
    <div className="pb-16">
      <h1 className="text-[22px] font-bold">Статистика</h1>

      <div className="mt-5 grid grid-cols-1 gap-[var(--gap)] min-[600px]:grid-cols-3">
        <Tile title="Всего" count={sum.all.count} hours={sum.all.hours} />
        <Tile
          title="Фильмы"
          count={sum.movies.count}
          hours={sum.movies.hours}
          href={catalogHref({ [QP.type]: 'movie' })}
        />
        <Tile
          title="Сериалы"
          count={sum.series.count}
          hours={sum.series.hours}
          href={catalogHref({ [QP.type]: 'tv' })}
        />
      </div>

      {(sum.withoutRuntime > 0 || sum.seriesWithoutEpisodes > 0) && (
        <p className="mt-2 text-[11.5px] text-text-3">
          Часы неполные:{' '}
          {[
            sum.withoutRuntime > 0 &&
              `${sum.withoutRuntime} без хронометража`,
            sum.seriesWithoutEpisodes > 0 &&
              `${sum.seriesWithoutEpisodes} ${plural(sum.seriesWithoutEpisodes, 'сериал', 'сериала', 'сериалов')} без числа серий`,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      )}

      <Section title="Мои оценки">
        {rated === 0 ? (
          <p className="text-text-3">Ни одной оценки пока не поставлено.</p>
        ) : (
          <>
            <div className="flex items-end gap-[6px]">
              {ratings.map((bar) => (
                <Link
                  key={bar.value}
                  href={catalogHref({ [QP.min]: String(bar.value) })}
                  className="flex flex-1 flex-col items-center gap-[6px] rounded-sm py-1 transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <span className="text-[11px] text-text-3">{bar.count || ''}</span>
                  <div
                    className="w-full rounded-xs bg-text-2"
                    style={{ height: `${scale(bar.count, ratings.map((r) => r.count))}px` }}
                  />
                  <span className="text-[11.5px] text-text-3">{bar.value}</span>
                </Link>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-text-3">
              Оценено {rated} {entriesWord(rated)} из {entries.length}
            </p>
          </>
        )}
      </Section>

      <Section title="По десятилетиям">
        <div className="flex flex-col gap-[6px]">
          {decades.map((row) => (
            <Bar
              key={row.decade}
              label={`${row.decade}-е`}
              value={row.count}
              max={Math.max(...decades.map((d) => d.count))}
              href={catalogHref({ [QP.decade]: String(row.decade) })}
            />
          ))}
        </div>
      </Section>

      <div className="mt-5 grid grid-cols-1 gap-[var(--gap)] min-[900px]:grid-cols-3">
        <Top title="Режиссёры" rows={stats.directors} toHref={(name) => catalogHref({ [QP.director]: name })} />
        <Top title="Жанры" rows={stats.genres} toHref={(name) => catalogHref({ [QP.genre]: name })} />
        <Top title="Страны" rows={stats.countries} toHref={(name) => catalogHref({ [QP.country]: name })} />
      </div>

      <Section title="Скачано">
        <p className="text-text-2">
          {downloaded.length} {entriesWord(downloaded.length)} лежит на диске
        </p>

        {disks.length > 0 && (
          <div className="mt-3 flex flex-col gap-[6px]">
            {disks.map((disk) => (
              <Bar
                key={disk.id}
                label={`Диск ${disk.label}`}
                value={disk.movies}
                max={Math.max(...disks.map((d) => d.movies), 1)}
                suffix={`${formatGb(disk.usedGb)} из ${formatGb(disk.sizeGb)} ГБ`}
                href={`/diski/${disk.id}`}
              />
            ))}
          </div>
        )}

        {entries.filter((e) => e.fileStatus === 'have' && e.diskId === null).length > 0 && (
          <p className="mt-2 text-[11.5px] text-text-3">
            {entries.filter((e) => e.fileStatus === 'have' && e.diskId === null).length} скачанных
            записей не привязаны к диску
          </p>
        )}
      </Section>

      <Section title="Расхождение с Кинопоиском">
        {gap.compared === 0 ? (
          <p className="text-text-3">
            Нужны свои оценки рядом с оценками КП — пока сравнивать нечего.
          </p>
        ) : gap.higher.length === 0 && gap.lower.length === 0 ? (
          <p className="text-text-3">
            Ни одного расхождения больше полутора баллов на {gap.compared}{' '}
            {plural(gap.compared, 'сравнении', 'сравнениях', 'сравнениях')}. Вкус совпадает.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--gap)] min-[600px]:grid-cols-2">
            <DiffList title="Я щедрее" rows={gap.higher} />
            <DiffList title="Я строже" rows={gap.lower} />
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─── Кусочки ────────────────────────────────────────────────────────── */

const BAR_MAX = 90;

function scale(value: number, all: number[]): number {
  const max = Math.max(...all, 1);
  return value === 0 ? 2 : Math.max(Math.round((value / max) * BAR_MAX), 3);
}

function Tile({
  title,
  count,
  hours,
  href,
}: {
  title: string;
  count: number;
  hours: number;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">{title}</p>
      <p className="mt-2 text-[22px] font-bold">{count}</p>
      <p className="mt-1 text-[11.5px] text-text-3">
        {hours} {plural(hours, 'час', 'часа', 'часов')}
      </p>
    </>
  );

  if (!href) return <div className="rounded-sm bg-surface p-[13px]">{body}</div>;

  return (
    <Link
      href={href}
      className="block rounded-sm bg-surface p-[13px] transition-colors duration-[120ms] hover:bg-surface-2"
    >
      {body}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-[18px]">
      <h2 className="text-[17px] font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bar({
  label,
  value,
  max,
  suffix,
  href,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="w-[110px] shrink-0 truncate text-[12px] text-text-2">{label}</span>
      <span className="h-[6px] flex-1 overflow-hidden rounded-pill bg-surface-3">
        <span
          className="block h-full rounded-pill bg-text-2"
          style={{ width: `${(value / Math.max(max, 1)) * 100}%` }}
        />
      </span>
      <span className="w-[36px] shrink-0 text-right text-[11.5px] text-text-3">{value}</span>
      {suffix && <span className="text-[11.5px] text-text-3">{suffix}</span>}
    </>
  );

  if (!href) return <div className="flex items-center gap-3">{content}</div>;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-sm transition-colors duration-[120ms] hover:bg-surface-2"
    >
      {content}
    </Link>
  );
}

function Top({
  title,
  rows,
  toHref,
}: {
  title: string;
  rows: [string, number][];
  toHref: (name: string) => string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-sm bg-surface p-[13px]">
      <h3 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">{title}</h3>
      <ol className="mt-3 flex flex-col gap-[6px]">
        {rows.map(([name, count]) => (
          <li key={name}>
            <Link
              href={toHref(name)}
              className="flex items-baseline gap-2 rounded-sm transition-colors duration-[120ms] hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{capitalize(name)}</span>
              <span className="text-[11.5px] text-text-3">{count}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DiffList({ title, rows }: { title: string; rows: Divergence[] }) {
  const { openCard } = useCard();

  return (
    <div className="rounded-sm bg-surface p-[13px]">
      <h3 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">{title}</h3>

      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-3">Пусто</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map(({ entry, diff }) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => openCard(entry.id)}
                className="flex w-full items-baseline gap-2 rounded-sm text-left transition-colors duration-[120ms] hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{entry.title}</span>
                <Score entry={entry} />
                <span className="w-[38px] shrink-0 text-right text-[11.5px] text-text-3">
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Score({ entry }: { entry: Entry }) {
  return (
    <span className="flex shrink-0 items-center gap-[5px] text-[11.5px]">
      <Star size={11} strokeWidth={1.5} className="fill-gold text-gold" />
      <span className="text-gold">{entry.rating}</span>
      <span className="text-text-3">против {entry.ratingKp?.toFixed(1)}</span>
    </span>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
