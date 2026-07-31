'use client';

import { Image as ImageIcon, Play, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { FILE_STATUS_LABELS, STATUS_LABELS, plural } from '@/lib/collection';
import type { FileStatus, Movie, Status } from '@/lib/db/schema';

import { useCollection } from './CollectionProvider';

/**
 * Карточка записи (5.7). Модальное окно поверх затемнённого экрана — так не
 * теряется позиция прокрутки. Любое поле правится по клику, сохранение
 * автоматическое, по расфокусировке.
 */
export function MovieCard({
  id,
  justAdded,
  onClose,
}: {
  id: number;
  justAdded: boolean;
  onClose: () => void;
}) {
  const { applyPatch } = useCollection();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/movies/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        return data.movie as Movie;
      })
      .then((loaded) => !cancelled && setMovie(loaded))
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  /** Сохранение по расфокусировке: пишем в базу и сразу в коллекцию в памяти. */
  const save = useCallback(
    async (fields: Partial<Movie>) => {
      setMovie((prev) => (prev ? { ...prev, ...fields } : prev));
      try {
        const res = await fetch(`/api/movies/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fields),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);

        setMovie(data.movie);
        applyPatch(id, data.movie);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id, applyPatch],
  );

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 sm:p-8"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={movie?.title ?? 'Карточка записи'}
        className="w-full max-w-[880px] rounded-lg bg-surface p-5 sm:p-[22px]"
      >
        <div className="flex items-start gap-4">
          {justAdded && (
            <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
              Добавлено — поставьте статус и оценку
            </p>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-text-3 transition-colors duration-[120ms] hover:text-text"
          >
            <X size={19} strokeWidth={1.5} />
          </button>
        </div>

        {error && <p className="mt-2 text-text-2">Ошибка: {error}</p>}

        {!movie ? (
          <p className="py-10 text-text-3">Загружаю карточку</p>
        ) : (
          <Body movie={movie} save={save} />
        )}
      </div>
    </div>
  );
}

function Body({ movie, save }: { movie: Movie; save: (fields: Partial<Movie>) => void }) {
  const isTv = movie.kind === 'tv';

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-full max-w-[200px] shrink-0 self-center sm:self-start">
          <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-xs bg-surface-2 text-icon-dim">
            {movie.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={22} strokeWidth={1.5} />
            )}
          </div>

          {movie.trailerKey && (
            <a
              href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-[7px] rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface-2"
            >
              <Play size={15} strokeWidth={1.5} />
              Трейлер
            </a>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <EditText
            value={movie.title}
            onSave={(title) => save({ title: title || movie.title })}
            className="w-full text-[22px] font-bold"
          />

          {movie.originalTitle && (
            <EditText
              value={movie.originalTitle}
              onSave={(originalTitle) => save({ originalTitle })}
              className="mt-1 w-full text-text-3"
            />
          )}

          <dl className="mt-4 flex flex-col gap-[6px]">
            <Row label="Год">
              <EditNumber value={movie.year} onSave={(year) => save({ year })} width={70} />
            </Row>

            {isTv ? (
              <>
                <Row label="Объём">
                  <span className="flex items-center gap-1">
                    <EditNumber
                      value={movie.seasons}
                      onSave={(seasons) => save({ seasons })}
                      width={48}
                    />
                    <span className="text-text-3">
                      {movie.seasons ? plural(movie.seasons, 'сезон', 'сезона', 'сезонов') : 'сезонов'},
                    </span>
                    <EditNumber
                      value={movie.episodes}
                      onSave={(episodes) => save({ episodes })}
                      width={48}
                    />
                    <span className="text-text-3">
                      {movie.episodes ? plural(movie.episodes, 'серия', 'серии', 'серий') : 'серий'},
                      ~
                    </span>
                    <EditNumber
                      value={movie.runtime}
                      onSave={(runtime) => save({ runtime })}
                      width={48}
                    />
                    <span className="text-text-3">мин серия</span>
                  </span>
                </Row>

                <Row label="Прогресс">
                  <span className="flex items-center gap-1 text-text-3">
                    S
                    <EditNumber
                      value={movie.progressSeason}
                      onSave={(progressSeason) => save({ progressSeason })}
                      width={44}
                    />
                    E
                    <EditNumber
                      value={movie.progressEpisode}
                      onSave={(progressEpisode) => save({ progressEpisode })}
                      width={44}
                    />
                  </span>
                </Row>
              </>
            ) : (
              <Row label="Хронометраж">
                <span className="flex items-center gap-1">
                  <EditNumber value={movie.runtime} onSave={(runtime) => save({ runtime })} width={56} />
                  <span className="text-text-3">мин</span>
                </span>
              </Row>
            )}

            <Row label={isTv ? 'Создатель' : 'Режиссёр'}>
              <EditText
                value={movie.director ?? ''}
                onSave={(director) => save({ director: director || null })}
                className="w-full"
              />
            </Row>

            <Row label="Продюсеры">{list(movie.producers)}</Row>
            <Row label="В ролях">{list(movie.cast)}</Row>
            <Row label="Жанры">{list(movie.genres)}</Row>
            <Row label="Страна">{list(movie.countries)}</Row>
          </dl>

          <div className="mt-4 flex items-center gap-4">
            <Star size={14} strokeWidth={1.5} className="shrink-0 fill-gold text-gold" />
            <Rating label="КП" value={movie.ratingKp} />
            <Rating label="IMDb" value={movie.ratingImdb} />
            <Rating label="TMDB" value={movie.ratingTmdb} />
          </div>

          {movie.overview && <p className="mt-4 text-text-2">{movie.overview}</p>}
        </div>
      </div>

      <Block title="Личное">
        <Row label="Статус">
          <Pills
            options={Object.entries(STATUS_LABELS)
              .filter(([value]) => value !== 'watching' || isTv)
              .map(([value, label]) => ({ value, label }))}
            value={movie.status}
            onPick={(status) => save({ status: status as Status })}
          />
        </Row>

        {movie.status === 'watched' && (
          <Row label="Пересмотр">
            <button
              type="button"
              onClick={() => save({ rewatch: movie.rewatch === 1 ? 0 : 1 })}
              className={`rounded-pill px-[15px] py-[7px] text-[12px] transition-colors duration-[120ms] ${
                movie.rewatch === 1
                  ? 'bg-red font-medium text-white hover:bg-red-hover'
                  : 'bg-surface-3 text-text-2 hover:text-text'
              }`}
            >
              Хочу пересмотреть
            </button>
          </Row>
        )}

        <Row label="Оценка">
          <Pills
            options={[
              { value: '', label: '—' },
              ...Array.from({ length: 10 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              })),
            ]}
            value={String(movie.rating ?? '')}
            onPick={(value) => save({ rating: value ? Number(value) : null })}
          />
        </Row>

        <Row label="Дата просмотра">
          <input
            type="date"
            defaultValue={movie.watchedAt ?? ''}
            onBlur={(e) => save({ watchedAt: e.target.value || null })}
            className="rounded-xs bg-surface-2 px-2 py-1 text-[12px] caret-red"
          />
        </Row>

        <Row label="Теги">
          <EditText
            value={fromJson(movie.tags).join(', ')}
            placeholder="через запятую"
            onSave={(value) => save({ tags: toJson(value) })}
            className="w-full"
          />
        </Row>

        <Row label="Заметка">
          <EditArea value={movie.note ?? ''} onSave={(note) => save({ note: note || null })} />
        </Row>
      </Block>

      <Block title="Файл">
        <Row label="Статус">
          <Pills
            options={Object.entries(FILE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={movie.fileStatus}
            onPick={(fileStatus) => save({ fileStatus: fileStatus as FileStatus })}
          />
        </Row>

        <Row label="Раздача">
          <EditText
            value={movie.torrentUrl ?? ''}
            placeholder="ссылка"
            onSave={(torrentUrl) => save({ torrentUrl: torrentUrl || null })}
            className="w-full"
          />
        </Row>

        <Row label="Хранилище">
          <EditText
            value={movie.storage ?? ''}
            placeholder="NAS, внешний HDD…"
            onSave={(storage) => save({ storage: storage || null })}
            className="w-full"
          />
        </Row>

        <Row label="Путь">
          <EditText
            value={movie.path ?? ''}
            placeholder="папка или полный путь"
            onSave={(path) => save({ path: path || null })}
            className="w-full"
          />
        </Row>

        <Row label="Качество">
          <EditText
            value={movie.quality ?? ''}
            placeholder="1080p, BDRemux…"
            onSave={(quality) => save({ quality: quality || null })}
            className="w-full"
          />
        </Row>
      </Block>
    </>
  );
}

/* ─── Кусочки ────────────────────────────────────────────────────────── */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">{title}</h3>
      <dl className="mt-3 flex flex-col gap-[10px]">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <dt className="w-[120px] shrink-0 pt-[3px] text-[11.5px] text-text-3">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
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

function Pills({
  options,
  value,
  onPick,
}: {
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onPick(option.value)}
          className={`rounded-pill px-[15px] py-[7px] text-[12px] transition-colors duration-[120ms] ${
            option.value === value
              ? 'bg-red font-medium text-white hover:bg-red-hover'
              : 'bg-surface-3 text-text-2 hover:text-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Поле правится по клику: выглядит текстом, по фокусу становится полем. */
function EditText({
  value,
  onSave,
  placeholder,
  className = '',
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value.trim())}
      className={`rounded-xs bg-transparent px-1 py-[2px] caret-red transition-colors duration-[120ms] hover:bg-surface-2 focus:bg-surface-2 ${className}`}
    />
  );
}

function EditNumber({
  value,
  onSave,
  width,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
  width: number;
}) {
  return (
    <input
      key={String(value)}
      type="number"
      min={0}
      defaultValue={value ?? ''}
      onBlur={(e) => {
        const next = e.target.value ? Number(e.target.value) : null;
        if (next !== value) onSave(next);
      }}
      style={{ width }}
      className="rounded-xs bg-transparent px-1 py-[2px] caret-red transition-colors duration-[120ms] hover:bg-surface-2 focus:bg-surface-2"
    />
  );
}

function EditArea({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  return (
    <textarea
      key={value}
      defaultValue={value}
      rows={3}
      placeholder="о чём это было"
      onBlur={(e) => e.target.value !== value && onSave(e.target.value.trim())}
      className="w-full resize-y rounded-xs bg-transparent px-1 py-[2px] caret-red transition-colors duration-[120ms] hover:bg-surface-2 focus:bg-surface-2"
    />
  );
}

function fromJson(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toJson(value: string): string {
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

function list(value: string | null): React.ReactNode {
  const items = fromJson(value);
  return items.length ? items.join(', ') : <span className="text-text-4">—</span>;
}
