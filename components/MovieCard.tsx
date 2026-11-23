'use client';

import {
  AlertCircle,
  Check,
  HardDrive,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Select } from '@/components/catalog/Select';
import { FILE_STATUS_LABELS, STATUS_DOT, STATUS_LABELS, formatDate, formatGb, plural } from '@/lib/collection';
import type { FileStatus, Movie, Status } from '@/lib/db/schema';
import { directorValue, listValue } from '@/lib/movie-patch';

import { useCollection } from './CollectionProvider';
import { useDisks } from './DisksProvider';
import { LAYER, hasModifier, isTyping, useLayer } from './layers';
import { useLists } from './ListsProvider';
import { CAST_ROWS, PosterColumn, Ratings, Row, fromJson, list, text, tvVolume } from './movie-view';
import { clearLayers, requestAddMore } from './url-state';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type RefillState = 'idle' | 'confirm' | 'running' | 'done' | 'kpFailed' | 'error';
type RemovalState = 'idle' | 'confirm' | 'running' | 'error';

/**
 * Карточка записи (5.7). Модальное окно поверх затемнённого экрана — так не
 * теряется позиция прокрутки. Любое поле правится по клику, сохранение
 * автоматическое, по расфокусировке.
 *
 * При листании ← → id меняется, а прежняя запись остаётся на экране, пока
 * не придёт новая: так окно не схлопывается до «Загружаю». В этот миг тело
 * карточки inert — правка не должна уйти в запись, которой не видно.
 *
 * Два режима (5.7). Обычный — текстовые и числовые поля показаны текстом;
 * статус, оценка, прогресс сериала, «В список», статус файла и диск активны
 * всегда. Режим правки — по карандашу: эти поля становятся полями ввода,
 * появляются «Перезаполнить из API» и «Сохранить». «Сохранить» возвращает
 * в обычный режим и карточку не закрывает.
 */
export function MovieCard({
  id,
  justAdded,
  onClose,
  canStep,
  onStep,
  closing,
  onClosed,
}: {
  id: number;
  justAdded: boolean;
  onClose: () => void;
  canStep: { prev: boolean; next: boolean };
  onStep: (delta: -1 | 1) => void;
  /** Адрес карточку уже закрыл («Назад») — последний кадр перед снятием. */
  closing: boolean;
  onClosed: () => void;
}) {
  const { applyPatch, removeEntry } = useCollection();
  const { dropMovie } = useLists();
  const { reload: reloadDisks } = useDisks();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refill, setRefill] = useState<RefillState>('idle');
  const [removal, setRemoval] = useState<RemovalState>('idle');
  /** Режим правки. Каждое открытие и листание ← → — обычный режим. */
  const [editing, setEditing] = useState(false);

  const currentId = useRef(id);

  /** Учёт идущих сохранений (п.5): сюда попадает каждый PATCH из полей
   * карточки, включая выпадающие списки «Статус»/«Диск» и вес — все они
   * вызывают один и тот же save(). */
  const pending = useRef<Set<Promise<void>>>(new Set());
  const batchFailed = useRef(false);
  const lastOutcome = useRef<'saved' | 'error'>('saved');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    currentId.current = id;
    setError(null);
    setRefill('idle');
    setRemoval('idle');
    setSaveState('idle');
    setEditing(false);

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

  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Фокус — в окно: иначе он остаётся в поле поиска под карточкой.
    dialog.current?.focus({ preventScroll: true });

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  /**
   * Сохранение по расфокусировке остаётся как есть — пишем в базу и сразу
   * в коллекцию в памяти. Каждый вызов кладёт свой промис в общий набор
   * pending, чтобы кнопка «Сохранить» могла дождаться всех сразу (п.3, п.5).
   */
  const save = useCallback(
    (fields: Partial<Movie>) => {
      setMovie((prev) => (prev && prev.id === id ? { ...prev, ...fields } : prev));
      setSaveState('saving');
      setRefill((state) => (state === 'running' || state === 'confirm' ? state : 'idle'));
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

          if (data.movie.id === currentId.current) setMovie(data.movie);
          applyPatch(data.movie.id, data.movie);
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

  /** Снять фокус (сработает сохранение активного поля) и дождаться всех PATCH.
   *  true — если всё, что было в работе, сохранилось. */
  const flush = useCallback(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (pending.current.size === 0) return true;

    while (pending.current.size > 0) {
      await Promise.allSettled(Array.from(pending.current));
    }
    return lastOutcome.current === 'saved';
  }, []);

  /**
   * «Сохранить», подсвеченный карандаш и Esc в правке: снять фокус (сработает
   * сохранение активного поля), дождаться всех PATCH этой карточки и при
   * успехе вернуться в обычный режим. Карточка остаётся открытой; при ошибке
   * остаётся и режим правки — со статусом внизу.
   */
  const finishEditing = useCallback(async () => {
    if (await flush()) setEditing(false);
  }, [flush]);

  // Крестик, клик вне окна, Esc в обычном режиме закрывают сразу, но сначала
  // снимают фокус — иначе правка в поле потерялась бы вместе с карточкой.
  const closeNow = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    onClose();
  }, [onClose]);

  // «Добавить ещё» (5.8): поиск откроется заново, когда карточка уйдёт из адреса.
  const addMore = useCallback(() => {
    requestAddMore();
    closeNow();
  }, [closeNow]);

  // Esc: обычный режим — закрыть; правка из поля — выйти из поля (оно
  // сохранится); правка вне поля — как «Сохранить». Открытые выпадающие
  // списки — слои выше, Esc сначала закрывает их.
  const escape = useCallback(() => {
    if (!editing) return closeNow();
    const active = document.activeElement as HTMLElement | null;
    if (isTyping(active)) active?.blur();
    else void finishEditing();
  }, [editing, closeNow, finishEditing]);

  const isTop = useLayer(LAYER.card, true, escape);

  /**
   * «Назад» закрывает карточку адресом, минуя closeNow. Провайдер держит её
   * ещё один кадр с closing: здесь, в обычном эффекте, снимается фокус — поле,
   * где он стоял, сохраняется так же, как при закрытии крестиком. При снятии
   * компонента это уже не сработало бы: React не доставляет blur из удаления.
   */
  useEffect(() => {
    if (!closing) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && dialog.current?.contains(active)) active.blur();
    onClosed();
  }, [closing, onClosed]);

  /** ← →: незавершённые правки сохраняются, как при «Сохранить»; не сохранились — остаёмся. */
  const stepping = useRef(false);
  const step = useCallback(
    async (delta: -1 | 1) => {
      if (stepping.current) return;
      stepping.current = true;
      try {
        if (await flush()) onStep(delta);
      } finally {
        stepping.current = false;
      }
    },
    [flush, onStep],
  );

  const runRefill = useCallback(async () => {
    setRefill('running');
    await flush();

    try {
      const res = await fetch(`/api/movies/${id}/refill`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);

      if (data.movie.id === currentId.current) setMovie(data.movie);
      applyPatch(data.movie.id, data.movie);
      setRefill(data.kpFailed ? 'kpFailed' : 'done');
    } catch {
      setRefill('error');
    }
  }, [id, flush, applyPatch]);

  /**
   * Удаление записи (5.7). Сначала дожидаемся идущих сохранений, чтобы PATCH
   * не ушёл в уже удалённую запись. Успех: карточка закрывается тем же
   * путём, что и обычно (?m= уходит из адреса), запись пропадает из
   * коллекции, подборок и сводки дисков в памяти. 404 — записи уже нет,
   * это тоже успех. Ошибка: окно остаётся, под вопросом строка с причиной.
   */
  const runDelete = useCallback(async () => {
    setRemoval('running');
    await flush();

    try {
      const res = await fetch(`/api/movies/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(res.statusText);

      setRemoval('idle');
      onClose();
      removeEntry(id);
      dropMovie(id);
      void reloadDisks();
    } catch {
      setRemoval('error');
    }
  }, [id, flush, onClose, removeEntry, dropMovie, reloadDisks]);

  const ready = movie !== null && movie.id === id;

  // Горячие клавиши карточки (5.11). Последние значения — через ref, чтобы
  // слушатель вешался один раз.
  const latest = useRef({ movie, ready, canStep, save, step, isTop, editing });
  useEffect(() => {
    latest.current = { movie, ready, canStep, save, step, isTop, editing };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { movie, ready, canStep, save, step, isTop, editing } = latest.current;
      if (!movie || !isTop() || hasModifier(event) || isTyping(event.target)) return;

      // Листать можно и пока соседняя запись грузится — порядок знает провайдер.
      // В режиме правки ← → не листают — чтобы не потерять ввод.
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (editing) return;
        const delta = event.key === 'ArrowLeft' ? -1 : 1;
        if (delta === -1 ? !canStep.prev : !canStep.next) return;
        event.preventDefault();
        void step(delta);
        return;
      }

      // Оценка и статус — только когда на экране та запись, что открыта.
      if (!ready || event.repeat) return;

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        void save({ rating: event.key === '0' ? 10 : Number(event.key) });
        return;
      }

      // По коду клавиши, а не по букве: в русской раскладке это «ц».
      if (event.code === 'KeyW') {
        event.preventDefault();
        void save({ status: movie.status === 'watched' ? 'none' : 'watched' });
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const hint = [
    !editing && (canStep.prev || canStep.next) && '← → соседняя',
    '1–0 оценка',
    'W смотрел',
    editing ? 'Esc готово' : 'Esc закрыть',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && closeNow()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 sm:p-8"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        style={{ outline: 'none' }}
        role="dialog"
        aria-modal="true"
        aria-label={movie?.title ?? 'Карточка записи'}
        className="w-full max-w-[880px] rounded-lg bg-surface p-5 sm:p-[22px]"
      >
        <div className="flex items-start gap-4">
          {justAdded && <AddedBar onAddMore={addMore} />}
          <span className="flex-1" />
          <button
            type="button"
            onClick={closeNow}
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
          <div inert={!ready} className={ready ? undefined : 'opacity-60'}>
            <Body key={movie.id} movie={movie} save={save} editing={editing} />
            {editing ? (
              <SaveBar
                saveState={saveState}
                onSave={() => void finishEditing()}
                refill={refill}
                onRefill={() => setRefill('confirm')}
                onDelete={() => setRemoval('confirm')}
              />
            ) : (
              <div className="mt-5 flex justify-end">
                <PencilButton on={false} onClick={() => setEditing(true)} />
              </div>
            )}
            <p className="mt-4 hidden text-[11px] text-text-4 min-[600px]:block">{hint}</p>
          </div>
        )}
      </div>

      {refill === 'confirm' && (
        <ConfirmRefill onConfirm={() => void runRefill()} onCancel={() => setRefill('idle')} />
      )}

      {removal !== 'idle' && (
        <ConfirmDelete
          title={movie?.title ?? ''}
          state={removal}
          onConfirm={() => void runDelete()}
          onCancel={() => setRemoval('idle')}
        />
      )}
    </div>
  );
}

/**
 * Верхняя строка карточки сразу после добавления (5.8): «Добавлено» и две
 * кнопки-ссылки. «На Главную» — обычная ссылка, но сначала снимает слои из
 * адреса: карточка и поиск читают адрес из истории, и сам переход их бы не
 * закрыл. «Добавить ещё» закрывает карточку и открывает поиск с пустым полем.
 */
function AddedBar({ onAddMore }: { onAddMore: () => void }) {
  const link =
    'rounded-xs text-[12.5px] font-medium text-text-2 transition-colors duration-[120ms] hover:text-text';

  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 pt-[1px]">
      <p className="text-[13px] font-medium">Добавлено</p>
      <Link
        href="/"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          // Поле, где стоял фокус, сохраняется по расфокусировке — до снятия карточки.
          (document.activeElement as HTMLElement | null)?.blur?.();
          clearLayers();
          // Уже на Главной — переходить некуда, только наверх.
          if (window.location.pathname === '/') {
            event.preventDefault();
            window.scrollTo(0, 0);
          }
        }}
        className={link}
      >
        На Главную
      </Link>
      <button type="button" onClick={onAddMore} className={link}>
        Добавить ещё
      </button>
    </div>
  );
}

/**
 * Нижняя строка режима правки: обычный элемент потока, без подложки и без
 * sticky. Слева — «Перезаполнить из API» (2.2) и строка статуса, справа —
 * подсвеченный карандаш и «Сохранить»; оба возвращают в обычный режим.
 */
function SaveBar({
  saveState,
  onSave,
  refill,
  onRefill,
  onDelete,
}: {
  saveState: SaveState;
  onSave: () => void;
  refill: RefillState;
  onRefill: () => void;
  onDelete: () => void;
}) {
  const refillNotice =
    refill === 'done' ? (
      <span className="text-text-3">Обновлено</span>
    ) : refill === 'kpFailed' ? (
      <Warning text="Обновлено, но Кинопоиск не ответил — оценки КП и IMDb прежние" />
    ) : refill === 'error' ? (
      <Warning text="Не удалось обновить" />
    ) : null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onDelete}
        aria-label="Удалить запись"
        title="Удалить запись"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-line-strong text-text-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-red"
      >
        <Trash2 size={18} strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={onRefill}
        disabled={refill === 'running'}
        className="inline-flex items-center gap-[7px] rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap transition-colors duration-[120ms] hover:bg-surface-2 disabled:opacity-60"
      >
        <RefreshCw size={15} strokeWidth={1.5} />
        {refill === 'running' ? 'Обновляю…' : 'Перезаполнить из API'}
      </button>

      <span className="flex items-center gap-[6px] text-[12px]">
        {refillNotice ?? (
          <>
            {saveState === 'saving' && <span className="text-text-3">Сохраняю…</span>}
            {saveState === 'saved' && <span className="text-text-3">Сохранено</span>}
            {saveState === 'error' && (
              <span className="flex items-center gap-[6px] text-text-2">
                <AlertCircle size={13} strokeWidth={1.5} />
                Не сохранилось, попробуй ещё раз
              </span>
            )}
          </>
        )}
      </span>

      <span className="flex-1" />

      <span className="flex items-center gap-2">
        <PencilButton on onClick={onSave} />

        {/* Не disabled на время сохранения: клик сразу после ввода в поле
            сам запускает сохранение (blur), и выключенная в этот миг кнопка
            съела бы его. Повторное нажатие безопасно — flush ждёт те же PATCH. */}
        <button
          type="button"
          onClick={onSave}
          aria-busy={saveState === 'saving'}
          className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-colors duration-[120ms] hover:bg-red-hover"
        >
          {saveState === 'saving' ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </span>
    </div>
  );
}

/** Карандаш: в обычном режиме включает правку, подсвеченный — как «Сохранить». */
function PencilButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Редактировать"
      aria-pressed={on}
      title="Редактировать"
      className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors duration-[120ms] ${
        on ? 'bg-surface-3 text-text' : 'text-text-2 hover:bg-surface-2 hover:text-text'
      }`}
    >
      <Pencil size={18} strokeWidth={1.5} />
    </button>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-[6px] text-text-2">
      <AlertCircle size={13} strokeWidth={1.5} className="shrink-0 text-orange" />
      {text}
    </span>
  );
}

/** Своё окно подтверждения в стиле карточки — не window.confirm. */
function ConfirmRefill({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useLayer(LAYER.dialog, true, onCancel);

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="refill-title"
        className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-5 sm:p-[22px]"
      >
        <p id="refill-title" className="text-[15px] font-bold">
          Перезаполнить из TMDB и Кинопоиска?
        </p>
        <p className="mt-2 text-text-2">Перезапишет все поля, кроме личных и сведений о файле.</p>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface-2"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
          >
            Перезаполнить
          </button>
        </div>
      </div>
    </div>
  );
}

/** Подтверждение удаления записи — своё окно, как у «Перезаполнить». */
function ConfirmDelete({
  title,
  state,
  onConfirm,
  onCancel,
}: {
  title: string;
  state: RemovalState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const running = state === 'running';
  // Пока идёт запрос, Esc и клик вне окна ничего не отменяют: ответ всё равно придёт.
  const cancel = () => {
    if (!running) onCancel();
  };
  useLayer(LAYER.dialog, true, cancel);

  return (
    <div
      onMouseDown={(event) => event.target === event.currentTarget && cancel()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-note"
        className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-5 sm:p-[22px]"
      >
        <p id="delete-title" className="text-[15px] font-bold">
          Удалить «{title}»?
        </p>
        <p id="delete-note" className="mt-2 text-[13px] text-text-2">
          Запись пропадёт из коллекции и из всех списков. Это нельзя отменить.
        </p>

        {state === 'error' && (
          <p className="mt-3 flex items-center gap-[6px] text-[12px] text-text-2">
            <AlertCircle size={13} strokeWidth={1.5} className="shrink-0 text-orange" />
            Не удалось удалить
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={cancel}
            disabled={running}
            className="rounded-pill bg-surface-3 px-[18px] py-[9px] text-[12.5px] font-medium transition-colors duration-[120ms] hover:bg-surface-2 disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={running}
            className="rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
          >
            {running ? 'Удаляю…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Body({
  movie,
  save,
  editing,
}: {
  movie: Movie;
  save: (fields: Partial<Movie>) => void;
  editing: boolean;
}) {
  const isTv = movie.kind === 'tv';

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row">
        <PosterColumn posterUrl={movie.posterUrl} trailerKey={movie.trailerKey} />

        <div className="min-w-0 flex-1">
          {editing ? (
            <EditText
              value={movie.title}
              label="Название"
              onSave={(title) => save({ title: title || movie.title })}
              className="w-full text-[22px] font-bold"
            />
          ) : (
            <h2 className="text-[22px] leading-tight font-bold break-words">{movie.title}</h2>
          )}

          {movie.originalTitle &&
            (editing ? (
              <EditText
                value={movie.originalTitle}
                label="Оригинальное название"
                onSave={(originalTitle) => save({ originalTitle: originalTitle || null })}
                className="mt-1 w-full text-text-3"
              />
            ) : (
              <p className="mt-1 break-words text-text-2">{movie.originalTitle}</p>
            ))}

          <dl className="mt-4 flex flex-col gap-[6px]">
            <Row label="Год">
              {editing ? (
                <EditNumber value={movie.year} label="Год" onSave={(year) => save({ year })} width={70} />
              ) : (
                text(movie.year === null ? null : String(movie.year))
              )}
            </Row>

            {isTv ? (
              <>
                <Row label="Объём">
                  {editing ? (
                    <span className="flex flex-wrap items-center gap-[6px]">
                      <EditNumber
                        value={movie.seasons}
                        label="Сезонов"
                        onSave={(seasons) => save({ seasons })}
                        width="calc(4ch + 22px)"
                      />
                      <span className="text-text-3">
                        {movie.seasons ? plural(movie.seasons, 'сезон', 'сезона', 'сезонов') : 'сезонов'},
                      </span>
                      <EditNumber
                        value={movie.episodes}
                        label="Серий"
                        onSave={(episodes) => save({ episodes })}
                        width="calc(4ch + 22px)"
                      />
                      <span className="text-text-3">
                        {movie.episodes ? plural(movie.episodes, 'серия', 'серии', 'серий') : 'серий'},
                        ~
                      </span>
                      <EditNumber
                        value={movie.runtime}
                        label="Минут в серии"
                        onSave={(runtime) => save({ runtime })}
                        width="calc(4ch + 22px)"
                      />
                      <span className="text-text-3">мин серия</span>
                    </span>
                  ) : (
                    text(tvVolume(movie))
                  )}
                </Row>

                {/* Прогресс правится всегда, без карандаша. */}
                <Row label="Прогресс">
                  <span className="flex flex-wrap items-center gap-[6px] text-text-3">
                    Сезон
                    <EditNumber
                      value={movie.progressSeason}
                      label="Сезон"
                      onSave={(progressSeason) => save({ progressSeason })}
                      width="calc(4ch + 22px)"
                    />
                    Серия
                    <EditNumber
                      value={movie.progressEpisode}
                      label="Серия"
                      onSave={(progressEpisode) => save({ progressEpisode })}
                      width="calc(4ch + 22px)"
                    />
                  </span>
                </Row>
              </>
            ) : (
              <Row label="Хронометраж">
                {editing ? (
                  <span className="flex items-center gap-1">
                    <EditNumber
                      value={movie.runtime}
                      label="Хронометраж"
                      onSave={(runtime) => save({ runtime })}
                      width="calc(4ch + 22px)"
                    />
                    <span className="text-text-3">мин</span>
                  </span>
                ) : (
                  text(movie.runtime === null ? null : `${movie.runtime} мин`)
                )}
              </Row>
            )}

            <Row label={isTv ? 'Создатель' : 'Режиссёр'}>
              {editing ? (
                <EditValues
                  label={isTv ? 'Создатель' : 'Режиссёр'}
                  value={movie.director ?? ''}
                  parse={directorValue}
                  onSave={(director) => save({ director })}
                />
              ) : (
                text(movie.director)
              )}
            </Row>

            {CAST_ROWS.map(({ field, label }) => (
              <Row key={field} label={label}>
                {editing ? (
                  <EditValues
                    label={label}
                    value={fromJson(movie[field]).join(', ')}
                    parse={(value) => listValue(field, value)}
                    stored={movie[field]}
                    onSave={(value) => save({ [field]: value })}
                  />
                ) : (
                  list(movie[field])
                )}
              </Row>
            ))}
          </dl>

          <Ratings movie={movie} />

          {movie.overview && <p className="mt-4 text-text-2">{movie.overview}</p>}
        </div>
      </div>

      <Block title="Личное" icon={UserRound} iconColor="var(--violet)">
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
          {editing ? (
            <input
              type="date"
              aria-label="Дата просмотра"
              defaultValue={movie.watchedAt ?? ''}
              onBlur={(e) => {
                const next = e.target.value || null;
                if (next !== movie.watchedAt) save({ watchedAt: next });
              }}
              className="field w-full text-[12px]"
            />
          ) : (
            text(movie.watchedAt && formatDate(movie.watchedAt))
          )}
        </Row>

        <Row label="Теги">
          {editing ? (
            <EditValues
              label="Теги"
              value={fromJson(movie.tags).join(', ')}
              parse={(value) => listValue('tags', value)}
              stored={movie.tags}
              onSave={(tags) => save({ tags })}
            />
          ) : (
            list(movie.tags)
          )}
        </Row>

        <Row label="Заметка">
          {editing ? (
            <EditArea value={movie.note ?? ''} onSave={(note) => save({ note: note || null })} />
          ) : movie.note ? (
            <p className="break-words whitespace-pre-line">{movie.note}</p>
          ) : (
            text(null)
          )}
        </Row>

        <Row label="Списки">
          <ListPicker movieId={movie.id} />
        </Row>
      </Block>

      <Block title="Файл" icon={HardDrive} iconColor="var(--sky)">
        <Row label="Статус">
          <Select
            label="Статус"
            options={Object.entries(FILE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            value={movie.fileStatus}
            onChange={(fileStatus) => save({ fileStatus: fileStatus as FileStatus })}
          />
        </Row>

        <Row label="Раздача">
          {editing ? (
            <EditText
              value={movie.torrentUrl ?? ''}
              label="Раздача"
              placeholder="ссылка"
              onSave={(torrentUrl) => save({ torrentUrl: torrentUrl || null })}
              className="w-full"
            />
          ) : (
            <TorrentLink value={movie.torrentUrl} />
          )}
        </Row>

        <Row label="Диск">
          <DiskField movie={movie} save={save} editing={editing} />
        </Row>

        <Row label="Путь">
          {editing ? (
            <EditText
              value={movie.path ?? ''}
              label="Путь"
              placeholder="папка или полный путь"
              onSave={(path) => save({ path: path || null })}
              className="w-full"
            />
          ) : (
            <span className="break-all">{text(movie.path)}</span>
          )}
        </Row>

        <Row label="Качество">
          {editing ? (
            <EditText
              value={movie.quality ?? ''}
              label="Качество"
              placeholder="1080p, BDRemux…"
              onSave={(quality) => save({ quality: quality || null })}
              className="w-full"
            />
          ) : (
            text(movie.quality)
          )}
        </Row>
      </Block>
    </>
  );
}

/**
 * Раздача в обычном режиме: http(s) и magnet — ссылка «Раздача ↗» в новой
 * вкладке, остальное (javascript: и прочее) — просто текст, не ссылка.
 */
function TorrentLink({ value }: { value: string | null }) {
  if (!value) return text(null);
  if (!/^(https?:\/\/|magnet:)/i.test(value)) return <span className="break-all">{value}</span>;
  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      className="underline decoration-line-strong underline-offset-[3px] transition-colors duration-[120ms] hover:decoration-text"
    >
      Раздача ↗
    </a>
  );
}

/**
 * Диск выбирается из заведённых всегда, без карандаша; рядом необязательный
 * вес в ГБ — он правится по карандашу. Вес нужен для подсчёта занятого места,
 * но без него запись всё равно числится на диске — просто попадает в «подсчёт
 * неполный». Рядом с именем диска — остаток места.
 */
function DiskField({
  movie,
  save,
  editing,
}: {
  movie: Movie;
  save: (fields: Partial<Movie>) => void;
  editing: boolean;
}) {
  const { disks, reload, loading, error } = useDisks();

  // Диска нет в списке («сирота» после удаления диска) — показываем «Нет диска».
  // Пока диски не загрузились или загрузка упала, значение не трогаем.
  const known =
    movie.diskId === null || loading || error !== null || disks.some((disk) => disk.id === movie.diskId);

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
        value={known ? String(movie.diskId ?? '') : ''}
        onChange={async (value) => {
          save({ diskId: value ? Number(value) : null });
          await reload();
        }}
      />

      {editing ? (
        <span className="flex items-center gap-[6px] text-text-3">
          <EditNumber
            value={movie.sizeGb}
            label="Вес, ГБ"
            onSave={async (sizeGb) => {
              save({ sizeGb });
              await reload();
            }}
            width={96}
            step="0.1"
          />
          ГБ
        </span>
      ) : (
        text(movie.sizeGb === null ? null : `${formatGb(movie.sizeGb)} ГБ`)
      )}
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

    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useLayer(LAYER.dialog, open, () => setOpen(false));

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

/** Блок «Личное» / «Файл»: заголовок с цветной иконкой, чтобы не сливался с подписями полей. */
function Block({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-line pt-[20px]">
      <h3 className="flex items-center gap-[8px] text-[13px] font-bold tracking-[.08em] text-text uppercase">
        <Icon size={16} strokeWidth={1.5} className="shrink-0" style={{ color: iconColor }} />
        {title}
      </h3>
      <dl className="mt-[16px] flex flex-col gap-[10px]">{children}</dl>
    </section>
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

/**
 * Строка состава в правке по карандашу: значения через запятую, разбор как
 * на сервере. Сохраняет по расфокусировке, только если итог изменился, и
 * сразу показывает итог разбора (повторы и пустые ушли).
 */
function EditValues({
  label,
  value,
  parse,
  stored,
  onSave,
}: {
  label: string;
  value: string;
  parse: (value: string) => string | null;
  /** Как список хранится сейчас (JSON). Без него поле — строка, как режиссёр. */
  stored?: string | null;
  onSave: (value: string | null) => void;
}) {
  const current = stored !== undefined ? stored : value || null;

  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={label}
      placeholder="через запятую"
      onBlur={(e) => {
        const next = parse(e.target.value);
        e.target.value = (stored !== undefined ? fromJson(next).join(', ') : next) ?? '';
        if (next !== current) onSave(next);
      }}
      className="field w-full"
    />
  );
}

/** Текстовое поле режима правки; сохраняет по расфокусировке. */
function EditText({
  value,
  label,
  onSave,
  placeholder,
  className = '',
}: {
  value: string;
  label: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value.trim())}
      className={`field ${className}`}
    />
  );
}

function EditNumber({
  value,
  label,
  onSave,
  width,
  step,
}: {
  value: number | null;
  label: string;
  onSave: (value: number | null) => void;
  width: number | string;
  step?: string;
}) {
  return (
    <input
      key={String(value)}
      aria-label={label}
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
      aria-label="Заметка"
      placeholder="о чём это было"
      onBlur={(e) => e.target.value !== value && onSave(e.target.value.trim())}
      className="field w-full resize-y"
    />
  );
}
