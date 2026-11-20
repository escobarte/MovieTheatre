'use client';

import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { LAYER, useLayer } from './layers';

/** Ключ сравнения: без регистра, ё = е. */
export function valueKey(value: string): string {
  return value.trim().toLowerCase().replaceAll('ё', 'е');
}

const LIMIT = 8;

/**
 * Редактор списка значений в карточке (5.7): жанры, актёры, страны,
 * продюсеры, теги. Значения — пилюли «не выбрано» с × справа, в конце поле
 * «добавить…»: Enter или запятая добавляет, Backspace в пустом поле убирает
 * последнее, расфокусировка добавляет набранное. Подсказки — из уже
 * загруженной коллекции, по подстроке без регистра и ё/е, до восьми,
 * ↑↓ и Enter выбирают. Повторы не добавляются, новое — в конец.
 */
export function ValuesEditor({
  values,
  onChange,
  suggestions,
  noun,
  normalize = (value) => value,
  display = (value) => value,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  /** Все известные значения поля, в порядке убывания частоты. */
  suggestions: string[];
  /** Для подписей кнопок: «Убрать жанр «драма»». */
  noun: string;
  normalize?: (value: string) => string;
  display?: (value: string) => string;
}) {
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(-1);
  const [focused, setFocused] = useState(false);
  const listId = useId();

  const taken = useMemo(() => new Set(values.map(valueKey)), [values]);

  const matches = useMemo(() => {
    const query = valueKey(text);
    if (!query) return [];
    return suggestions
      .filter((value) => !taken.has(valueKey(value)) && valueKey(value).includes(query))
      .slice(0, LIMIT);
  }, [text, suggestions, taken]);

  const open = focused && matches.length > 0;
  useLayer(LAYER.dropdown, open, () => setFocused(false));

  const add = (raw: string) => {
    const typed = normalize(raw.trim());
    setText('');
    setCursor(-1);
    if (!typed || taken.has(valueKey(typed))) return;

    // Совпало с известным значением без учёта регистра — берём его написание.
    const known = suggestions.find((value) => valueKey(value) === valueKey(typed));
    onChange([...values, known ?? typed]);
  };

  const remove = (value: string) => onChange(values.filter((v) => v !== value));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      setFocused(true);
      setCursor((c) => Math.min(c + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      add(cursor >= 0 && open ? matches[cursor] : text);
    } else if (event.key === ',') {
      event.preventDefault();
      add(text);
    } else if (event.key === 'Backspace' && text === '' && values.length) {
      event.preventDefault();
      remove(values[values.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex max-w-full min-w-0 items-center gap-[2px] rounded-pill border border-line-strong py-[3px] pr-[4px] pl-[12px] text-[12px] text-text"
        >
          <span className="min-w-0 truncate">{display(value)}</span>
          <button
            type="button"
            onClick={() => remove(value)}
            aria-label={`Убрать ${noun} «${display(value)}»`}
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-text-3 transition-colors duration-[120ms] hover:bg-surface-3 hover:text-text"
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </span>
      ))}

      <div className="relative min-w-[120px] flex-1">
        <input
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            // Вставка «а, б, в» — каждое через запятую сразу пилюлей.
            if (next.includes(',')) {
              const parts = next.split(',');
              const rest = parts.pop() ?? '';
              let current = values;
              for (const part of parts) {
                const typed = normalize(part.trim());
                if (typed && !current.some((v) => valueKey(v) === valueKey(typed))) {
                  const known = suggestions.find((v) => valueKey(v) === valueKey(typed));
                  current = [...current, known ?? typed];
                }
              }
              if (current !== values) onChange(current);
              setText(rest);
            } else {
              setText(next);
            }
            setCursor(-1);
            setFocused(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (text.trim()) add(text);
          }}
          placeholder="добавить…"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={`Добавить ${noun}`}
          className="field w-full text-[12px]"
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 max-h-[280px] overflow-y-auto rounded-md border border-line-strong bg-surface-2 p-[6px]"
          >
            {matches.map((value, index) => (
              <li key={value} role="option" aria-selected={index === cursor}>
                <button
                  type="button"
                  tabIndex={-1}
                  // Без mousedown-фокуса поле не теряет фокус, и blur не добавит набранное.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(value)}
                  className={`w-full truncate rounded-sm px-[10px] py-[6px] text-left text-[12px] transition-colors duration-[120ms] hover:bg-surface-3 ${
                    index === cursor ? 'bg-surface-3 text-text' : 'text-text-2'
                  }`}
                >
                  {display(value)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
