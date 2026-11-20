'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Карточка и поиск живут в адресе (5.7): ?m=<id> и ?search=1|add. Открытие
 * кладёт шаг в историю — «Назад» (в том числе системная на Android и в
 * установленном приложении) закрывает слой. Закрытие из интерфейса идёт
 * через history.back(), если шаг положили мы, иначе параметр убирается
 * через replaceState — пустых шагов в истории не остаётся.
 *
 * Свой шаг помечается в history.state (mtCard / mtSearch): пометка
 * переживает перезагрузку. Состояние передаётся новым объектом — тогда
 * Next копирует в него свои служебные поля и синхронизирует роутер
 * (useSearchParams видит новый адрес).
 */

export const URL_PARAM = { card: 'm', search: 'search' } as const;
export type Marker = 'mtCard' | 'mtSearch';

const CHANGE = 'mt:url';

function urlWith(changes: Record<string, string | null>): string {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return url.pathname + url.search + url.hash;
}

/** Наши пометки текущего шага — их надо сохранить при replaceState. */
function ownMarkers(): Partial<Record<Marker, true>> {
  const state = window.history.state as Partial<Record<Marker, boolean>> | null;
  return {
    ...(state?.mtCard ? { mtCard: true } : {}),
    ...(state?.mtSearch ? { mtSearch: true } : {}),
  };
}

export function pushParam(name: string, value: string, marker: Marker) {
  window.history.pushState({ [marker]: true }, '', urlWith({ [name]: value }));
  window.dispatchEvent(new Event(CHANGE));
}

export function replaceParam(name: string, value: string | null) {
  window.history.replaceState(ownMarkers(), '', urlWith({ [name]: value }));
  window.dispatchEvent(new Event(CHANGE));
}

/** Значение параметра в адресе. На сервере и до гидратации — null. */
export function useUrlParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setValue(new URLSearchParams(window.location.search).get(name));
    read();
    window.addEventListener('popstate', read);
    window.addEventListener(CHANGE, read);
    return () => {
      window.removeEventListener('popstate', read);
      window.removeEventListener(CHANGE, read);
    };
  }, [name]);

  return value;
}

/**
 * Закрыть слой, открытый параметром name. Повторный вызов до того, как
 * адрес сменился, игнорируется: двойной Esc не должен увести со страницы.
 */
export function useCloseParam(name: string, marker: Marker, value: string | null) {
  const closing = useRef(false);

  useEffect(() => {
    closing.current = false;
  }, [value]);

  return useCallback(() => {
    if (closing.current || value === null) return;
    closing.current = true;

    const state = window.history.state as Partial<Record<Marker, boolean>> | null;
    if (state?.[marker]) window.history.back();
    else replaceParam(name, null);
  }, [name, marker, value]);
}
