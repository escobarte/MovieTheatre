'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import type { Entry } from '@/lib/collection';

import { Poster } from './Poster';

/**
 * Полка: горизонтальная прокрутка, постер 104px, зазор --gap. Правый край
 * обрезается на половине карточки — это подсказка, что прокрутка есть (6.5).
 * Вертикальный padding обязателен, иначе увеличенный при наведении постер
 * подрежется краем прокрутки (6.6).
 *
 * Пустая полка не отображается вовсе — заглушек «здесь пока ничего нет»
 * быть не должно (5.2).
 */
export function Shelf({
  icon: Icon,
  title,
  entries,
  href,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  entries: Entry[];
  href: string;
  badge?: (entry: Entry) => string | undefined;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="mt-[26px]">
      <div className="flex items-center gap-[10px]">
        <Icon size={18} strokeWidth={1.5} className="shrink-0 text-red" />
        <h2 className="text-[17px] font-bold">{title}</h2>
        <span className="text-[12px] text-text-3">{entries.length}</span>
        <span className="flex-1" />
        <Link
          href={href}
          aria-label={`${title}: открыть в каталоге`}
          className="text-text-2 transition-colors duration-[120ms] hover:text-text"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </Link>
      </div>

      <div className="-my-2 flex gap-[var(--gap)] overflow-x-auto py-2">
        {entries.map((entry) => (
          <div key={entry.id} className="w-[104px] shrink-0">
            <Poster entry={entry} badge={badge?.(entry)} />
          </div>
        ))}
      </div>
    </section>
  );
}
