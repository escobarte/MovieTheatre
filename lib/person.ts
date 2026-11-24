/** Общие формы поиска людей (5.5): и сервер, и клиент. */

export type Department = 'actor' | 'director' | 'other';

export type PersonHit = {
  id: number;
  name: string;
  photoUrl: string | null;
  department: Department;
};

/** Работа человека — в форме строки результата поиска (без отметки «в коллекции»). */
export type Credit = {
  tmdbId: number;
  kind: 'movie' | 'tv';
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  director: null;
};

export type PersonCredits = {
  person: PersonHit;
  actor: Credit[];
  director: Credit[];
  /** Ключи `<kind>-<tmdbId>` работ, которые уже есть в коллекции. */
  added: string[];
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  actor: 'актёр',
  director: 'режиссёр',
  other: 'другое',
};
