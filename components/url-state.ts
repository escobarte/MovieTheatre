'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Карточка и поиск живут в адресе (5.7): ?m=<id> и ?search=1|add, поп-ап
 * предпросмотра результата TMDB поверх поиска — ?p=<kind>-<tmdbId> (5.8). Открытие
 * кладёт шаг в историю — «Назад» (в том числе системная на Android и в
 * установленном приложении) закрывает слой. Закрытие из интерфейса идёт
 * через history.back(), если шаг положили мы, иначе параметр убирается
 * через replaceState — пустых шагов в истории не остаётся.
 *
 * Свой шаг помечается в history.state (mtCard / mtSearch / mtPreview): пометка
 * переживает перезагрузку. Состояние передаётся новым объектом — тогда
 * Next копирует в него свои служебные поля и синхронизирует роутер
 * (useSearchParams видит новый адрес).
 */

export const URL_PARAM = { card: 'm', search: 'search', preview: 'p' } as const;
export type Marker = 'mtCard' | 'mtSearch' | 'mtPreview';

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
    ...(state?.mtPreview ? { mtPreview: true } : {}),
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

/**
 * Открыть слой name вместо слоя drop одним шагом: карточка после добавления
 * из поп-апа предпросмотра встаёт на место поп-апа, и «Назад» из неё ведёт
 * в поиск, а не в уже ненужный поп-ап. Если шаг поп-апа не наш (открыт
 * ссылкой), он просто убирается из адреса, а карточка кладёт свой шаг.
 */
export function swapParam(drop: string, dropMarker: Marker, name: string, value: string, marker: Marker) {
  const state = window.history.state as Partial<Record<Marker, boolean>> | null;
  if (state?.[dropMarker]) {
    window.history.replaceState({ [marker]: true }, '', urlWith({ [drop]: null, [name]: value }));
  } else {
    window.history.replaceState(ownMarkers(), '', urlWith({ [drop]: null }));
    window.history.pushState({ [marker]: true }, '', urlWith({ [name]: value }));
  }
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Снять все слои из адреса сразу, без шагов назад: перед переходом на другую
 * страницу ссылкой. Слои читают адрес из истории, а не из роутера Next,
 * поэтому сам переход их бы не закрыл.
 */
export function clearLayers() {
  window.history.replaceState(
    {},
    '',
    urlWith({ [URL_PARAM.card]: null, [URL_PARAM.search]: null, [URL_PARAM.preview]: null }),
  );
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * «Добавить ещё» из карточки (5.8). Карточка лежит вне SearchProvider,
 * поэтому просьба идёт событием: поиск дожидается, пока карточка уйдёт из
 * адреса, и открывается заново в режиме добавления с пустым полем.
 */
export const ADD_MORE = 'mt:add-more';

export function requestAddMore() {
  window.dispatchEvent(new Event(ADD_MORE));
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
