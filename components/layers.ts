'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Esc закрывает только верхний открытый слой (5.11): выпадающий список →
 * окно «В список» и подтверждения в карточке → карточка → поп-ап
 * предпросмотра в поиске → оверлей поиска.
 * «Верхний» — по рангу, а не по времени открытия: так порядок не зависит
 * от того, что открыли раньше. Один слушатель на документ на всех.
 */
export const LAYER = { search: 10, preview: 15, card: 20, dialog: 30, dropdown: 40 } as const;

type Layer = { rank: number; order: number; close: () => void };

const layers = new Set<Layer>();
let opened = 0;

function topLayer(): Layer | undefined {
  let top: Layer | undefined;
  for (const layer of layers) {
    if (!top || layer.rank > top.rank || (layer.rank === top.rank && layer.order > top.order)) {
      top = layer;
    }
  }
  return top;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = topLayer();
  if (!top) return;
  event.preventDefault();
  top.close();
}

/**
 * Регистрирует слой, пока open. Возвращает isTop() — открыт ли сейчас
 * выше него другой слой; горячие клавиши карточки молчат, если да.
 */
export function useLayer(rank: number, open: boolean, close: () => void): () => boolean {
  const closeRef = useRef(close);
  const self = useRef<Layer | null>(null);

  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;

    const layer: Layer = { rank, order: ++opened, close: () => closeRef.current() };
    if (layers.size === 0) document.addEventListener('keydown', onKeyDown);
    layers.add(layer);
    self.current = layer;

    return () => {
      layers.delete(layer);
      self.current = null;
      if (layers.size === 0) document.removeEventListener('keydown', onKeyDown);
    };
  }, [rank, open]);

  return useCallback(() => self.current !== null && topLayer() === self.current, []);
}

/** Печатает ли пользователь прямо сейчас — тогда горячие клавиши молчат. */
export function isTyping(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

/** Ctrl/Cmd/Alt — это чужие сочетания (браузера, системы), их не перехватываем. */
export function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}
