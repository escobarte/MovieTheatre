'use client';

import { useEffect } from 'react';

/**
 * Трекает модальность ввода на <html data-input="keyboard|pointer">, чтобы
 * globals.css показывал рамку фокуса только после клавиатуры (6.6). Нативной
 * эвристике :focus-visible для этого недостаточно: клиентская навигация
 * Next.js ставит фокус на <a> после клика асинхронно, вне синхронного
 * контекста клика, и браузер иногда решает, что фокус пришёл не от мыши —
 * рамка остаётся после обычного клика.
 */
export function FocusRing() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') document.documentElement.setAttribute('data-input', 'keyboard');
    };
    const onPointerDown = () => document.documentElement.setAttribute('data-input', 'pointer');

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return null;
}
