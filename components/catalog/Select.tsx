'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type SelectOption = { value: string; label: string; hint?: string };

/**
 * Выпадающий список с одним значением, всегда выбранным (6.5): вид тот же,
 * что у FilterSelect в «Всё кино», но без мультивыбора и без счётчиков —
 * здесь каждое значение само по себе ответ, поэтому подпись всегда
 * показывает его: «Статус: Скачан». Используется в карточке записи для
 * статуса файла и выбора диска.
 */
export function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  const current = options.find((o) => o.value === value);

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-[6px] rounded-pill bg-surface-3 px-[14px] py-[7px] text-[12px] whitespace-nowrap text-text transition-colors duration-[120ms]"
      >
        {label}: {current?.label ?? value}
        <ChevronDown size={13} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-20 max-h-[280px] min-w-[210px] overflow-y-auto rounded-lg border border-line bg-surface p-[6px]">
          {options.map((option) => {
            const on = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-[10px] py-[6px] text-left text-[12px] transition-colors duration-[120ms] hover:bg-surface-2"
              >
                <span className="w-[14px] shrink-0 text-red">
                  {on && <Check size={14} strokeWidth={1.5} />}
                </span>
                <span className={`flex-1 ${on ? 'text-text' : 'text-text-2'}`}>{option.label}</span>
                {option.hint && <span className="text-text-3">{option.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
