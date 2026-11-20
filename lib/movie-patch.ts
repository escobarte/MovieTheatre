/**
 * Состав и жанры (5.7): режиссёр — строка, продюсеры, актёры, жанры и
 * страны — JSON string[] (схема 2.1). Правка с клиента и с сервера проходит
 * один и тот же разбор: по запятой, trim, без пустых и повторов (без учёта
 * регистра), порядок сохраняется; жанры — в нижнем регистре, как хранятся.
 * Пустое значение — null.
 */

export const LIST_FIELDS = ['producers', 'cast', 'genres', 'countries'] as const;
export type ListField = (typeof LIST_FIELDS)[number];

const sameKey = (value: string) => value.toLowerCase().replaceAll('ё', 'е');

/** Значения из массива или из строки через запятую — чистые, без повторов. */
export function cleanValues(input: string | string[], lowercase = false): string[] {
  const raw = typeof input === 'string' ? input.split(',') : input;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const value = lowercase ? item.trim().toLowerCase() : item.trim();
    if (!value || seen.has(sameKey(value))) continue;
    seen.add(sameKey(value));
    out.push(value);
  }
  return out;
}

/** Режиссёр из строки через запятую: «A, B» или null. */
export function directorValue(input: string): string | null {
  const values = cleanValues(input);
  return values.length ? values.join(', ') : null;
}

/** Список из строки через запятую: JSON string[] или null. */
export function listValue(field: ListField, input: string | string[]): string | null {
  const values = cleanValues(input, field === 'genres');
  return values.length ? JSON.stringify(values) : null;
}

/**
 * Приводит эти пять полей правки к виду схемы, остальные пропускает как
 * есть. Неверный тип — ошибка, запись не меняется (400).
 */
export function normalizePatch(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields };

  if ('director' in fields) {
    const value = fields.director;
    if (value === null) out.director = null;
    else if (typeof value === 'string') out.director = directorValue(value);
    else throw new Error('director: ожидается строка');
  }

  for (const field of LIST_FIELDS) {
    if (!(field in fields)) continue;
    const value = fields[field];
    if (value === null) {
      out[field] = null;
      continue;
    }

    let items: unknown = value;
    if (typeof value === 'string') {
      try {
        items = value.trim() === '' ? [] : JSON.parse(value);
      } catch {
        throw new Error(`${field}: ожидается список строк`);
      }
    }
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
      throw new Error(`${field}: ожидается список строк`);
    }
    out[field] = listValue(field, items as string[]);
  }

  return out;
}
