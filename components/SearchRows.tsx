'use client';

import { Image as ImageIcon, Plus } from 'lucide-react';

export type Candidate = {
  tmdbId: number;
  kind: 'movie' | 'tv';
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  director: string | null;
  added: boolean;
};

/** Ключ кандидата: tmdbId у фильма и сериала может совпасть. */
export const candidateKey = (c: Pick<Candidate, 'kind' | 'tmdbId'>) => `${c.kind}-${c.tmdbId}`;

/** Общие строки поиска: результаты TMDB и фильмография человека (5.5, 5.8). */

export function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex h-[57px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-xs bg-surface-2 text-icon-dim">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={16} strokeWidth={1.5} />
      )}
    </span>
  );
}

export /**
 * Строка результата TMDB. Клик или касание в любом месте, кроме «Добавить»,
 * открывает поп-ап со сведениями; сама строка-кнопка — для Tab и Enter.
 */
function CandidateRow({
  candidate,
  busy,
  active,
  onOpen,
  onAdd,
}: {
  candidate: Candidate;
  busy: boolean;
  active: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const meta = [
    candidate.year,
    candidate.kind === 'tv' ? 'сериал' : candidate.originalTitle,
    candidate.director,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onClick={onOpen}
      className={`flex cursor-pointer items-center gap-[14px] rounded-sm px-3 py-[11px] transition-colors duration-[120ms] hover:bg-surface ${
        active ? 'bg-surface' : ''
      }`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-center gap-[14px] rounded-xs text-left"
      >
        <Thumb url={candidate.posterUrl} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{candidate.title}</span>
          <span className="mt-[3px] block truncate text-[12px] text-text-3">{meta || '—'}</span>
        </span>
      </button>

      {candidate.added ? (
        <span className="text-[12.5px] text-text-3">в коллекции</span>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          disabled={busy}
          className="inline-flex items-center gap-[6px] rounded-pill bg-red px-[16px] py-[8px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={1.5} />
          {busy ? 'Тяну…' : 'Добавить'}
        </button>
      )}
    </div>
  );
}
