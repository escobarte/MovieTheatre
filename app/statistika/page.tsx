'use client';

import { DatabaseBackup, Download, Film, Library, Star, Tv } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useCard } from '@/components/CardProvider';
import { useCollection } from '@/components/CollectionProvider';
import { DiskBar } from '@/components/DiskBar';
import { useDisks } from '@/components/DisksProvider';
import { useLists } from '@/components/ListsProvider';
import { backupDate } from '@/lib/backup';
import { entriesWord, formatDate, formatGb, plural, type Entry } from '@/lib/collection';
import { NO_DISK, QP, catalogHref } from '@/lib/query';
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
 * Разделы — в боксах --panel-sky, графики и иконки — вторичной палитрой
 * (--sky/--violet/--st-watching): по 6.4 красный отдан действиям, а жёлтый
 * только звезде рейтинга. Последний бокс — резервная копия базы (SPEC 9),
 * он есть и при пустой коллекции: списки и диски тоже стоит сохранять.
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
        <div className="mt-10 text-left">
          <BackupPanel entries={0} />
        </div>
      </div>
    );
  }

  const { totals: sum, ratings, decades, divergence: gap } = stats;
  const rated = entries.filter((e) => e.rating !== null).length;
  const downloaded = entries.filter((e) => e.fileStatus === 'have');
  // diskId «сироты» (диска уже нет) коллекция отдаёт как null — такие записи
  // тоже попадают в «без диска».
  const unlinked = downloaded.filter((e) => e.diskId === null).length;

  return (
    <div className="pb-16">
      <h1 className="text-[22px] font-bold">Статистика</h1>

      <Panel>
        <div className="grid grid-cols-1 gap-[var(--gap)] min-[600px]:grid-cols-3">
          <Tile icon={Library} iconColor="var(--sky)" title="Всего" count={sum.all.count} hours={sum.all.hours} />
          <Tile
            icon={Film}
            iconColor="var(--violet)"
            title="Фильмы"
            count={sum.movies.count}
            hours={sum.movies.hours}
            href={catalogHref({ [QP.type]: 'movie' })}
          />
          <Tile
            icon={Tv}
            iconColor="var(--st-watching)"
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
      </Panel>

      <Panel title="Мои оценки">
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
                  <span className="text-[11px] text-text-2">{bar.count || ''}</span>
                  <div
                    className="w-full rounded-xs"
                    style={{
                      height: `${scale(bar.count, ratings.map((r) => r.count))}px`,
                      background: bar.count > 0 ? 'var(--sky)' : 'var(--surface-3)',
                    }}
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
      </Panel>

      <Panel title="По десятилетиям">
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
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 gap-[var(--gap)] min-[900px]:grid-cols-3">
          <Top title="Режиссёры" rows={stats.directors} toHref={(name) => catalogHref({ [QP.director]: name })} />
          <Top title="Жанры" rows={stats.genres} toHref={(name) => catalogHref({ [QP.genre]: name })} />
          <Top title="Страны" rows={stats.countries} toHref={(name) => catalogHref({ [QP.country]: name })} />
        </div>
      </Panel>

      <Panel title="Сколько скачано и на каких дисках">
        {downloaded.length === 0 ? (
          <p className="text-text-3">Скачанных пока нет</p>
        ) : (
          <>
            <Row
              className="text-[13px] text-text"
              href={catalogHref({ [QP.file]: 'have' })}
            >
              Скачано: {downloaded.length}
            </Row>
            <Row
              className="mt-1 text-[12.5px] text-text-2"
              href={
                disks.length > 0 && downloaded.length - unlinked > 0
                  ? catalogHref({ [QP.file]: 'have', [QP.disk]: disks.map((d) => d.id).join(',') })
                  : undefined
              }
            >
              на дисках — {downloaded.length - unlinked}
            </Row>
            {unlinked > 0 && (
              <Row
                className="text-[12.5px] text-text-2"
                href={catalogHref({ [QP.file]: 'have', [QP.disk]: NO_DISK })}
              >
                без диска — {unlinked}
              </Row>
            )}

            {disks.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-text-3">
                Дисков пока нет — заведи их на странице{' '}
                <Link
                  href="/diski"
                  className="underline underline-offset-2 transition-colors duration-[120ms] hover:text-text"
                >
                  «Диски»
                </Link>
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-[6px]">
                {/* Порядок и заполнение — из той же сводки, что на «Дисках». */}
                {disks.map((disk) => (
                  <Bar
                    key={disk.id}
                    label={`Диск ${disk.label}`}
                    value={disk.movies}
                    meter={<DiskBar disk={disk} className="min-w-[60px] flex-1" />}
                    suffix={
                      <>
                        {formatGb(disk.usedGb)} из {formatGb(disk.sizeGb)} ГБ
                        {disk.moviesWithoutSize > 0 && (
                          <span className="ml-2 text-[11px]">подсчёт неполный</span>
                        )}
                      </>
                    }
                    href={disk.movies > 0 ? catalogHref({ [QP.disk]: String(disk.id) }) : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title="Расхождение с Кинопоиском">
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
            <DiffList title="Я щедрее" rows={gap.higher} tone="watched" />
            <DiffList title="Я строже" rows={gap.lower} tone="orange" />
          </div>
        )}
      </Panel>

      <BackupPanel entries={entries.length} />
    </div>
  );
}

/* ─── Кусочки ────────────────────────────────────────────────────────── */

const BAR_MAX = 90;

function scale(value: number, all: number[]): number {
  const max = Math.max(...all, 1);
  return value === 0 ? 3 : Math.max(Math.round((value / max) * BAR_MAX), 3);
}

/** Бокс раздела (п.3 правок «больше цвета») — тот же вид, что у полки Главной. */
function Panel({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mt-[20px] rounded-lg border p-[20px]"
      style={{ background: 'var(--panel-sky)', borderColor: 'var(--panel-sky-line)' }}
    >
      {title && (
        <h2 className="flex items-center gap-[10px] text-[17px] font-bold">
          {Icon && <Icon size={18} strokeWidth={1.5} className="shrink-0" style={{ color: iconColor }} />}
          {title}
        </h2>
      )}
      <div className={title ? 'mt-4' : undefined}>{children}</div>
    </section>
  );
}

/* ─── Резервная копия (SPEC 9) ───────────────────────────────────────── */

/** Дата последней копии с этого устройства, «2026-11-20». */
const LAST_BACKUP_KEY = 'mt:last-backup';

function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function BackupPanel({ entries }: { entries: number }) {
  const { lists, views } = useLists();
  const { disks } = useDisks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  // localStorage есть только в браузере: читаем после монтирования.
  useEffect(() => setLast(readLastBackup()), []);

  // Это обычная ссылка на /api/export с download: файл скачивается и без
  // скриптов. Со скриптами — тот же файл через fetch, чтобы показать
  // «Готовлю…» и запомнить дату только после удачной загрузки.
  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/export', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? res.statusText);
      }
      const blob = await res.blob();
      const header = res.headers.get('Content-Disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(header)?.[1] ?? `movie-theatre-${backupDate()}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const today = backupDate();
      try {
        localStorage.setItem(LAST_BACKUP_KEY, today);
      } catch {
        // Без хранилища дата просто не запомнится.
      }
      setLast(today);
    } catch (err) {
      setError((err as Error).message || 'не удалось');
    } finally {
      setBusy(false);
    }
  }

  const counts = [
    `${entries} ${entriesWord(entries)}`,
    `${lists.length} ${plural(lists.length, 'список', 'списка', 'списков')}`,
    `${views.length} ${plural(views.length, 'фильтр', 'фильтра', 'фильтров')}`,
    `${disks.length} ${plural(disks.length, 'диск', 'диска', 'дисков')}`,
  ].join(' · ');

  return (
    <Panel title="Резервная копия" icon={DatabaseBackup} iconColor="var(--sky)">
      <p className="text-[13px] text-text-2">
        Вся база одним файлом. Раз в месяц скачивай и храни вне Vercel и Turso — на своём диске
        или в облаке.
      </p>
      <p className="mt-2 text-[12px] text-text-3">{counts}</p>

      <a
        href="/api/export"
        download
        onClick={download}
        aria-busy={busy}
        className="mt-4 inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover"
      >
        <Download size={15} strokeWidth={1.5} />
        {busy ? 'Готовлю…' : 'Скачать копию'}
      </a>

      {error && <p className="mt-2 text-[12px] text-text-2">Не скачалось: {error}</p>}

      <p className="mt-3 text-[12px] text-text-3">
        {last
          ? `Последняя копия с этого устройства: ${formatDate(last)}`
          : 'С этого устройства копий ещё не было'}
      </p>
    </Panel>
  );
}

function Tile({
  icon: Icon,
  iconColor,
  title,
  count,
  hours,
  href,
}: {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  count: number;
  hours: number;
  href?: string;
}) {
  const body = (
    <>
      <p className="flex items-center gap-[6px] text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
        <Icon size={16} strokeWidth={1.5} style={{ color: iconColor }} />
        {title}
      </p>
      <p className="mt-2 text-[22px] font-bold">{count}</p>
      <p className="mt-1 text-[11.5px] text-text-3">
        {hours} {plural(hours, 'час', 'часа', 'часов')}
      </p>
    </>
  );

  if (!href) return <div className="rounded-sm border border-line bg-surface p-[13px]">{body}</div>;

  return (
    <Link
      href={href}
      className="block rounded-sm border border-line bg-surface p-[13px] transition-colors duration-[120ms] hover:bg-surface-2"
    >
      {body}
    </Link>
  );
}

/** Строка-число: при нуле или без цели — простой текст, иначе ссылка в каталог. */
function Row({
  className,
  href,
  children,
}: {
  className: string;
  href?: string;
  children: React.ReactNode;
}) {
  if (!href) return <p className={className}>{children}</p>;

  return (
    <Link
      href={href}
      className={`block cursor-pointer rounded-sm transition-colors duration-[120ms] hover:bg-surface-2 ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * Строка с полосой. По умолчанию полоса — value / max; meter подменяет её
 * своей (у дисков — заполнение диска, а не доля записей).
 */
function Bar({
  label,
  value,
  max = 1,
  meter,
  suffix,
  href,
}: {
  label: string;
  value: number;
  max?: number;
  meter?: React.ReactNode;
  suffix?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="w-[110px] shrink-0 truncate text-[12px] text-text-2">{label}</span>
      {meter ?? (
        <span className="h-[6px] min-w-[60px] flex-1 overflow-hidden rounded-pill bg-surface-3">
          <span
            className="block h-full rounded-pill bg-sky"
            style={{ width: `${(value / Math.max(max, 1)) * 100}%` }}
          />
        </span>
      )}
      <span className="w-[36px] shrink-0 text-right text-[11.5px] text-text-3">{value}</span>
      {/* Ширина подписи постоянная, чтобы полосы соседних строк были одной длины. */}
      {suffix && (
        <span className="text-[11.5px] whitespace-nowrap text-text-3 min-[600px]:w-[210px] min-[600px]:shrink-0">
          {suffix}
        </span>
      )}
    </>
  );

  // На узком экране подпись справа переносится под полосу, а не выдавливает страницу вбок.
  if (!href) return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{content}</div>;

  return (
    <Link
      href={href}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm transition-colors duration-[120ms] hover:bg-surface-2"
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
  const max = Math.max(...rows.map(([, count]) => count), 1);

  return (
    <div className="rounded-sm bg-surface p-[13px]">
      <h3 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">{title}</h3>
      <ol className="mt-3 flex flex-col gap-[8px]">
        {rows.map(([name, count]) => (
          <li key={name}>
            <Link
              href={toHref(name)}
              className="flex items-baseline gap-2 rounded-sm transition-colors duration-[120ms] hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{capitalize(name)}</span>
              <span className="text-[11.5px] text-text-3">{count}</span>
            </Link>
            <span className="mt-1 block h-[4px] overflow-hidden rounded-pill bg-surface-3">
              <span
                className="block h-full rounded-pill bg-sky"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DiffList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Divergence[];
  tone: 'watched' | 'orange';
}) {
  const { openCard } = useCard();
  const dotColor = tone === 'watched' ? 'var(--st-watched)' : 'var(--orange)';

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
                onClick={() => openCard(entry.id, { sequence: rows.map((row) => row.entry.id) })}
                className="flex w-full items-baseline gap-2 rounded-sm text-left transition-colors duration-[120ms] hover:bg-surface-2"
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dotColor }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{entry.title}</span>
                <Score entry={entry} />
                <span className="w-[38px] shrink-0 text-right text-[11.5px]" style={{ color: dotColor }}>
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
