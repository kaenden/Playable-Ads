/**
 * Pointer + touch girişi. Merge'de sürükleme vardı, burada TEK DOKUNUŞ.
 *
 * Eski Android WebView'lerde PointerEvent olmayabiliyor (bazı ad SDK
 * container'ları hâlâ eski webview kullanıyor), o yüzden fallback var —
 * merge'de öğrendiğimiz her şey burada da geçerli.
 */
import { Layout, UiState } from './layout';
import { State, tap, reset } from './state';
import { audio } from '../../core/audio';
import { LOT } from './config';

export interface InputHooks {
  onInteract(): void;
  onCta(): void;
  onReset(): void;
}

export interface Picker {
  cellAt(x: number, y: number): number;
}

export function bindInput(
  cv: HTMLCanvasElement,
  L: Layout,
  pick: Picker,
  s: State,
  ui: UiState,
  hooks: InputHooks
): void {
  function pos(e: MouseEvent | Touch): [number, number] {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function down(x: number, y: number): void {
    hooks.onInteract();

    if (L.inRect(L.sound, x, y)) {
      audio.toggle();
      return;
    }

    if (s.status !== 'playing') {
      // Kutlama sahnesinde hiçbir buton yok — ödül anı kesilmiyor.
      if (s.endT < LOT.celebrateFor) return;
      if (L.inRect(L.secondary, x, y)) {
        reset(s);
        hooks.onReset();
        return;
      }
      if (L.inRect(L.cta, x, y)) hooks.onCta();
      return;
    }

    if (L.inRect(L.cta, x, y)) {
      hooks.onCta();
      return;
    }

    const cell = pick.cellAt(x, y);
    if (cell >= 0) {
      ui.press = cell;
      tap(s, cell);
    }
  }

  function up(): void {
    ui.press = -1;
  }

  if (window.PointerEvent) {
    cv.addEventListener('pointerdown', (e) => {
      // Bazı webview'larda ve sentetik (QA) event'lerde capture atıyor.
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        /* yok say */
      }
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  } else {
    cv.addEventListener('touchstart', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      down(x, y);
    });
    cv.addEventListener('touchend', up);
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('mouseup', up);
  }

  // Ad container içinde sayfa kaydırma / zoom asla olmamalı.
  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block as EventListener);
  document.addEventListener('contextmenu', block);
}
