'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { LAYER, useLayer } from '@/components/layers';

export type Option = { value: string; label: string; count: number };

/**
 * Селектор фильтра (6.5). Со включённым значением — фон --surface-3 и
 * значение прямо в подписи: «Файл: скачан». Рядом с каждым значением
 * счётчик подходящих записей с учётом уже включённых фильтров (5.4);
 * значения с нулём не прячутся — по ним и видно сочетания, дающие ноль.
 */
export function FilterSelect({
  label,
  options,
  selected,
  onChange,
  dot,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Цвет точки перед значением — сейчас только у фильтра «Статус» (6.4). */
  dot?: (value: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useLayer(LAYER.dropdown, open, () => setOpen(false));

  if (options.length === 0) return null;

  const active = selected.length > 0;
  const caption = !active
    ? label
    : selected.length === 1
      ? `${label}: ${options.find((o) => o.value === selected[0])?.label ?? selected[0]}`
      : `${label}: ${selected.length}`;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-[6px] rounded-pill px-[14px] py-[7px] text-[12px] whitespace-nowrap transition-colors duration-[120ms] ${
          active
            ? 'bg-red font-medium text-white hover:bg-red-hover'
            : 'border border-line-strong text-text hover:bg-surface-2'
        }`}
      >
        {caption}
        <ChevronDown size={13} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-20 max-h-[280px] min-w-[210px] overflow-y-auto rounded-md border border-line-strong bg-surface-2 p-[6px]">
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-sm px-[10px] py-[6px] text-left text-[12px] text-red transition-colors duration-[120ms] hover:bg-surface-3"
            >
              Снять выбор
            </button>
          )}

          {options.map((option) => {
            const on = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-[10px] py-[6px] text-left text-[12px] transition-colors duration-[120ms] hover:bg-surface-3"
              >
                <span className="w-[14px] shrink-0 text-red">
                  {on && <Check size={14} strokeWidth={1.5} />}
                </span>
                {dot?.(option.value) && (
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: dot(option.value) }}
                  />
                )}
                <span className={`flex-1 ${on ? 'text-text' : 'text-text-2'}`}>{option.label}</span>
                <span className={option.count === 0 ? 'text-text-4' : 'text-text-3'}>
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
