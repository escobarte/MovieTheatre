'use client';

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
 * Полка на Главной лежит в боксе небесно-голубого оттенка (правка по
 * замечаниям, п.3) — цвет только здесь, в правило двух акцентов и в общие
 * токены поверхностей не входит.
 *
 * Пустая полка не отображается вовсе — заглушек «здесь пока ничего нет»
 * быть не должно (5.2).
 */
export function Shelf({
  icon: Icon,
  iconColor = 'var(--red)',
  title,
  entries,
  href,
  badge,
}: {
  icon: LucideIcon;
  /** Цвет иконки заголовка (п.1 правок «больше цвета») — по умолчанию красный. */
  iconColor?: string;
  title: string;
  entries: Entry[];
  href: string;
  badge?: (entry: Entry) => string | undefined;
}) {
  if (entries.length === 0) return null;

  return (
    <section
      className="mt-[20px] rounded-lg border pt-[16px] pr-[20px] pb-[20px] pl-[20px]"
      style={{ background: 'var(--panel-sky)', borderColor: 'var(--panel-sky-line)' }}
    >
      <div className="flex items-center gap-[10px]">
        <Icon size={18} strokeWidth={1.5} className="shrink-0" style={{ color: iconColor }} />
        <h2 className="text-[17px] font-bold">{title}</h2>
        <span className="rounded-pill bg-surface-2 px-[8px] py-[2px] text-[11.5px] text-text-2">
          {entries.length}
        </span>
        <span className="flex-1" />
        <Link
          href={href}
          className="shrink-0 text-[12.5px] text-text-2 transition-colors duration-[120ms] hover:text-text"
        >
          Все →
        </Link>
      </div>

      <div className="mt-[6px] -mb-2 flex gap-[var(--gap)] overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((entry) => (
          <div key={entry.id} className="w-[104px] shrink-0">
            <Poster entry={entry} badge={badge?.(entry)} />
          </div>
        ))}
      </div>
    </section>
  );
}
