'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Селектор с одним значением: сортировка, источник оценки. Вид тот же (6.5). */
export function PickOne<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
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

  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-[6px] rounded-pill bg-surface px-[14px] py-[7px] text-[12px] whitespace-nowrap text-text-2 transition-colors duration-[120ms] hover:text-text"
      >
        {label ? `${label}: ${current}` : current}
        <ChevronDown size={13} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-20 min-w-[190px] rounded-lg border border-line bg-surface p-[6px]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full rounded-sm px-[10px] py-[6px] text-left text-[12px] transition-colors duration-[120ms] hover:bg-surface-2 ${
                option.value === value ? 'text-text' : 'text-text-2'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
