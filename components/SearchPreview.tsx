'use client';

import { AlertCircle, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Kind } from '@/lib/db/schema';
import type { PreviewMovie, PreviewResponse } from '@/lib/preview';

import { LAYER, useLayer } from './layers';
import { CAST_ROWS, PosterColumn, Ratings, Row, list, text, tvVolume } from './movie-view';

export type AddOutcome = 'added' | 'duplicate' | 'error';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; movie: PreviewMovie; added: boolean };

/**
 * Поп-ап с полными сведениями о результате поиска TMDB до добавления (5.8).
 * Сведения собираются на лету тем же кодом, что при добавлении, но в базу
 * ничего не пишется (GET /api/search/preview). Поля, порядок и форматирование —
 * как в обычном режиме карточки (общие кусочки в movie-view).
 *
 * Лежит поверх оверлея поиска своим шагом истории (?p=): Esc и «Назад»
 * закрывают только его, поиск с запросом, выдачей и прокруткой остаётся.
 * Тело прокручивается внутри, нижняя строка с кнопками всегда на виду.
 */
export function SearchPreview({
  kind,
  tmdbId,
  title,
  added: addedInList,
  busy,
  onAdd,
  onClose,
}: {
  kind: Kind;
  tmdbId: number;
  /** Название из выдачи — для подписи окна, пока сведения грузятся. */
  title: string | null;
  /** Помечено ли «в коллекции» в выдаче поиска. */
  added: boolean;
  busy: boolean;
  onAdd: () => Promise<AddOutcome>;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [addFailed, setAddFailed] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useLayer(LAYER.preview, true, onClose);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/search/preview?tmdbId=${tmdbId}&type=${kind}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? res.statusText);
        return data as PreviewResponse;
      })
      .then((data) => !cancelled && setLoad({ state: 'ready', movie: data.movie, added: data.added }))
      .catch(() => !cancelled && setLoad({ state: 'error' }));

    return () => {
      cancelled = true;
    };
  }, [kind, tmdbId]);

  // Фокус — в окно: иначе Enter и стрелки уйдут в поле поиска под ним.
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
  }, []);

  const added = addedInList || duplicate || (load.state === 'ready' && load.added);
  const movie = load.state === 'ready' ? load.movie : null;

  const add = async () => {
    setAddFailed(false);
    const outcome = await onAdd();
    if (outcome === 'duplicate') setDuplicate(true);
    if (outcome === 'error') setAddFailed(true);
  };

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-bg/80 p-4 sm:p-8"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        style={{ outline: 'none' }}
        role="dialog"
        aria-modal="true"
        aria-label={movie?.title ?? title ?? 'Сведения о записи'}
        className="flex max-h-full w-full max-w-[880px] flex-col rounded-lg border border-line bg-surface"
      >
        <div className="flex shrink-0 items-center gap-4 px-5 pt-4 sm:px-[22px] sm:pt-[18px]">
          <p className="text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
            {kind === 'tv' ? 'Сериал' : 'Фильм'} · TMDB
          </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-5 sm:px-[22px]">
          {load.state === 'loading' && <Skeleton />}

          {load.state === 'error' && (
            <p className="flex items-center gap-[6px] py-6 text-text-2">
              <AlertCircle size={15} strokeWidth={1.5} className="shrink-0 text-orange" />
              Не удалось загрузить сведения
            </p>
          )}

          {movie && <Facts movie={movie} />}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 sm:px-[22px]">
          {addFailed && (
            <span className="mr-auto flex items-center gap-[6px] text-[12px] text-text-2">
              <AlertCircle size={13} strokeWidth={1.5} className="shrink-0 text-orange" />
              Не удалось добавить
            </span>
          )}
          {load.state !== 'error' && added && (
            <span className="mr-auto text-[12.5px] text-text-3">Уже в коллекции</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface-2"
          >
            Закрыть
          </button>

          {load.state !== 'error' && !added && (
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              className="inline-flex items-center gap-[6px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
            >
              <Plus size={14} strokeWidth={1.5} />
              {busy ? 'Тяну…' : 'Добавить'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Верх карточки в обычном режиме (5.7) — без личных полей и файла. */
function Facts({ movie }: { movie: PreviewMovie }) {
  const isTv = movie.kind === 'tv';

  return (
    <div className="flex flex-col gap-5 sm:flex-row">
      <PosterColumn posterUrl={movie.posterUrl} trailerKey={movie.trailerKey} />

      <div className="min-w-0 flex-1">
        <h2 className="text-[22px] leading-tight font-bold break-words">{movie.title}</h2>
        {movie.originalTitle && <p className="mt-1 break-words text-text-2">{movie.originalTitle}</p>}

        <dl className="mt-4 flex flex-col gap-[6px]">
          <Row label="Год">{text(movie.year === null ? null : String(movie.year))}</Row>
          {isTv ? (
            <Row label="Объём">{text(tvVolume(movie))}</Row>
          ) : (
            <Row label="Хронометраж">{text(movie.runtime === null ? null : `${movie.runtime} мин`)}</Row>
          )}
          <Row label={isTv ? 'Создатель' : 'Режиссёр'}>{text(movie.director)}</Row>
          {CAST_ROWS.map(({ field, label }) => (
            <Row key={field} label={label}>
              {list(movie[field])}
            </Row>
          ))}
        </dl>

        <Ratings movie={movie} />

        {movie.overview && <p className="mt-4 text-text-2">{movie.overview}</p>}
      </div>
    </div>
  );
}

/** Заглушка на время загрузки: те же блоки, что у сведений, без движения. */
function Skeleton() {
  const bar = 'rounded-xs bg-surface-2';

  return (
    <div aria-busy="true" aria-label="Загружаю сведения" className="flex flex-col gap-5 sm:flex-row">
      <div className="w-full max-w-[200px] shrink-0 self-center sm:self-start">
        <div className={`aspect-[2/3] ${bar}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`h-[26px] w-2/3 ${bar}`} />
        <div className={`mt-2 h-[14px] w-1/3 ${bar}`} />
        <div className="mt-5 flex flex-col gap-[10px]">
          {[45, 30, 55, 70, 85, 50, 40].map((width, i) => (
            <div key={i} className={`h-[13px] ${bar}`} style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className={`mt-5 h-[14px] w-1/2 ${bar}`} />
        <div className="mt-5 flex flex-col gap-[8px]">
          <div className={`h-[12px] w-full ${bar}`} />
          <div className={`h-[12px] w-full ${bar}`} />
          <div className={`h-[12px] w-3/4 ${bar}`} />
        </div>
      </div>
    </div>
  );
}
