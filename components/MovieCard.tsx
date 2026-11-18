'use client';

import { AlertCircle, Check, Image as ImageIcon, Play, Plus, Star, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Select } from '@/components/catalog/Select';
import { FILE_STATUS_LABELS, STATUS_DOT, STATUS_LABELS, formatGb, plural } from '@/lib/collection';
import type { FileStatus, Movie, Status } from '@/lib/db/schema';

import { useCollection } from './CollectionProvider';
import { useDisks } from './DisksProvider';
import { useLists } from './ListsProvider';

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

  /** Учёт идущих сохранений (п.5): сюда попадает каждый PATCH из полей
   * карточки, включая выпадающие списки «Статус»/«Диск» и вес — все они
   * вызывают один и тот же save(). */
  const pending = useRef<Set<Promise<void>>>(new Set());
  const batchFailed = useRef(false);
  const lastOutcome = useRef<'saved' | 'error'>('saved');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [onClose]);

  /**
   * Сохранение по расфокусировке остаётся как есть — пишем в базу и сразу
   * в коллекцию в памяти. Каждый вызов кладёт свой промис в общий набор
   * pending, чтобы кнопка «Сохранить» могла дождаться всех сразу (п.3, п.5).
   */
  const save = useCallback(
    (fields: Partial<Movie>) => {
      setMovie((prev) => (prev ? { ...prev, ...fields } : prev));
      setSaveState('saving');
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
        savedTimer.current = null;
      }

      let task!: Promise<void>;
      task = (async () => {
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
          batchFailed.current = true;
          setError((e as Error).message);
        } finally {
          pending.current.delete(task);
          if (pending.current.size === 0) {
            if (batchFailed.current) {
              batchFailed.current = false;
              lastOutcome.current = 'error';
              setSaveState('error');
            } else {
              lastOutcome.current = 'saved';
              setSaveState('saved');
              savedTimer.current = setTimeout(() => setSaveState('idle'), 2000);
            }
          }
        }
      })();

      pending.current.add(task);
      return task;
    },
    [id, applyPatch],
  );

  /**
   * Кнопка «Сохранить» (п.3): снимает фокус, чтобы сработало сохранение
   * активного поля, ждёт все идущие PATCH этой карточки и закрывает карточку,
   * только если все они прошли успешно.
   */
  const handleSaveClick = useCallback(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();

    while (pending.current.size > 0) {
      await Promise.allSettled(Array.from(pending.current));
    }

    if (lastOutcome.current === 'saved') onClose();
  }, [onClose]);

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
          <>
            <Body movie={movie} save={save} />
            <SaveBar saveState={saveState} onSave={handleSaveClick} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Строка с кнопкой «Сохранить» в самом конце карточки (п.1–4): обычный
 * элемент потока, без подложки и без sticky — прокрутил до конца, нажал.
 */
function SaveBar({
  saveState,
  onSave,
}: {
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <span className="flex items-center gap-[6px] text-[12px]">
        {saveState === 'saving' && <span className="text-text-3">Сохраняю…</span>}
        {saveState === 'saved' && <span className="text-text-3">Сохранено</span>}
        {saveState === 'error' && (
          <span className="flex items-center gap-[6px] text-text-2">
            <AlertCircle size={13} strokeWidth={1.5} />
            Не сохранилось, попробуй ещё раз
          </span>
        )}
      </span>

      <span className="flex-1" />

      <button
        type="button"
        onClick={onSave}
        disabled={saveState === 'saving'}
        className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
      >
        {saveState === 'saving' ? 'Сохраняю…' : 'Сохранить'}
      </button>
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
              className="mt-3 flex items-center justify-center gap-[7px] rounded-pill bg-text px-[18px] py-[9px] text-[12.5px] font-medium text-bg transition-colors duration-[120ms] hover:bg-white"
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
                  <span className="flex flex-wrap items-center gap-[6px]">
                    <EditNumber
                      value={movie.seasons}
                      onSave={(seasons) => save({ seasons })}
                      width="calc(4ch + 22px)"
                    />
                    <span className="text-text-3">
                      {movie.seasons ? plural(movie.seasons, 'сезон', 'сезона', 'сезонов') : 'сезонов'},
                    </span>
                    <EditNumber
                      value={movie.episodes}
                      onSave={(episodes) => save({ episodes })}
                      width="calc(4ch + 22px)"
                    />
                    <span className="text-text-3">
                      {movie.episodes ? plural(movie.episodes, 'серия', 'серии', 'серий') : 'серий'},
                      ~
                    </span>
                    <EditNumber
                      value={movie.runtime}
                      onSave={(runtime) => save({ runtime })}
                      width="calc(4ch + 22px)"
                    />
                    <span className="text-text-3">мин серия</span>
                  </span>
                </Row>

                <Row label="Прогресс">
                  <span className="flex flex-wrap items-center gap-[6px] text-text-3">
                    Сезон
                    <EditNumber
                      value={movie.progressSeason}
                      onSave={(progressSeason) => save({ progressSeason })}
                      width="calc(4ch + 22px)"
                    />
                    Серия
                    <EditNumber
                      value={movie.progressEpisode}
                      onSave={(progressEpisode) => save({ progressEpisode })}
                      width="calc(4ch + 22px)"
                    />
                  </span>
                </Row>
              </>
            ) : (
              <Row label="Хронометраж">
                <span className="flex items-center gap-1">
                  <EditNumber
                    value={movie.runtime}
                    onSave={(runtime) => save({ runtime })}
                    width="calc(4ch + 22px)"
                  />
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
            dot={(value) => STATUS_DOT[value as Status]}
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
            className="field w-full text-[12px]"
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

        <Row label="Списки">
          <ListPicker movieId={movie.id} />
        </Row>
      </Block>

      <Block title="Файл">
        <Row label="Статус">
          <Select
            label="Статус"
            options={Object.entries(FILE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={movie.fileStatus}
            onChange={(fileStatus) => save({ fileStatus: fileStatus as FileStatus })}
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

        <Row label="Диск">
          <DiskField movie={movie} save={save} />
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

/**
 * Диск выбирается из заведённых, рядом необязательный вес в ГБ. Вес нужен
 * для подсчёта занятого места, но без него запись всё равно числится на диске
 * — просто попадает в «подсчёт неполный». Рядом с именем диска — остаток
 * места, чтобы было видно, куда ещё есть смысл класть файл.
 */
function DiskField({
  movie,
  save,
}: {
  movie: Movie;
  save: (fields: Partial<Movie>) => void;
}) {
  const { disks, reload } = useDisks();

  const options = [
    { value: '', label: 'Нет диска' },
    ...disks.map((disk) => ({
      value: String(disk.id),
      label: `Диск ${disk.label}`,
      hint: `свободно ${formatGb(disk.freeGb)} ГБ`,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <Select
        label="Диск"
        options={options}
        value={String(movie.diskId ?? '')}
        onChange={async (value) => {
          save({ diskId: value ? Number(value) : null });
          await reload();
        }}
      />

      <span className="flex items-center gap-[6px] text-text-3">
        <EditNumber
          value={movie.sizeGb}
          onSave={async (sizeGb) => {
            save({ sizeGb });
            await reload();
          }}
          width={96}
          step="0.1"
        />
        ГБ
      </span>
    </div>
  );
}

/**
 * Добавление в подборку прямо из карточки (правка по ручной проверке, п.2):
 * панель теперь с видимой рамкой — раньше её фон совпадал с фоном карточки
 * и она сливалась. Строка списка — флажок, название, число записей; клик
 * сразу добавляет или убирает, без закрытия панели. Под кнопкой — названия
 * списков, где фильм уже есть, пилюлями «не выбрано».
 */
function ListPicker({ movieId }: { movieId: number }) {
  const { lists, addToList, putItems, createList } = useLists();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const inside = lists.filter((list) => list.items.some((item) => item.movieId === movieId));

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (listId: number) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    if (list.items.some((item) => item.movieId === movieId)) {
      void putItems(
        listId,
        list.items.filter((item) => item.movieId !== movieId),
      );
    } else {
      void addToList(listId, movieId);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    const created = await createList(title.trim());
    if (created) await addToList(created.id, movieId);
    setTitle('');
  };

  return (
    <div ref={box} className="relative inline-flex flex-col items-start gap-[8px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-[6px] rounded-pill bg-surface-3 px-[15px] py-[7px] text-[12px] text-text-2 transition-colors duration-[120ms] hover:text-text"
      >
        <Plus size={13} strokeWidth={1.5} />В список
      </button>

      {inside.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {inside.map((list) => (
            <span
              key={list.id}
              className="rounded-pill border border-line-strong px-[15px] py-[7px] text-[12px] text-text"
            >
              {list.title}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-10 min-w-[240px] rounded-md border border-line-strong bg-surface-2 p-[6px]">
          {lists.length > 0 && (
            <div className="max-h-[220px] overflow-y-auto">
              {lists.map((list) => {
                const on = list.items.some((item) => item.movieId === movieId);
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => toggle(list.id)}
                    className="flex w-full items-center gap-[8px] rounded-sm px-[8px] py-[7px] text-left text-[12px] transition-colors duration-[120ms] hover:bg-surface-3"
                  >
                    <span
                      className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-xs border ${
                        on ? 'border-red bg-red' : 'border-line-strong'
                      }`}
                    >
                      {on && <Check size={11} strokeWidth={2} className="text-white" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text">{list.title}</span>
                    <span className="shrink-0 text-text-3">{list.items.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <form
            onSubmit={create}
            className={`flex items-center gap-[6px] ${
              lists.length > 0 ? 'mt-[6px] border-t border-line-strong pt-[6px]' : ''
            }`}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Новый список"
              className="field min-w-0 flex-1 text-[12px]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-pill bg-red px-[12px] py-[6px] text-[12px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
            >
              Создать
            </button>
          </form>
        </div>
      )}
    </div>
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
  dot,
}: {
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  /** Цвет точки перед подписью — сейчас только у «Статуса» (6.4). */
  dot?: (value: string) => string | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {options.map((option) => {
        const on = option.value === value;
        const dotColor = dot?.(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className={`inline-flex items-center gap-[7px] rounded-pill px-[15px] py-[7px] text-[12px] transition-colors duration-[120ms] ${
              on
                ? 'bg-red font-medium text-white hover:bg-red-hover'
                : 'bg-surface-3 text-text-2 hover:text-text'
            }`}
          >
            {dotColor && (
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: on ? '#FFFFFF' : dotColor }}
              />
            )}
            {option.label}
          </button>
        );
      })}
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
      className={`field ${className}`}
    />
  );
}

function EditNumber({
  value,
  onSave,
  width,
  step,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
  width: number | string;
  step?: string;
}) {
  return (
    <input
      key={String(value)}
      type="number"
      min={0}
      step={step}
      defaultValue={value ?? ''}
      onBlur={(e) => {
        const next = e.target.value ? Number(e.target.value) : null;
        if (next !== value) onSave(next);
      }}
      style={{ width }}
      className="field"
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
      className="field w-full resize-y"
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
