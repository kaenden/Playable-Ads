/**
 * Pointer + touch girişi. Tek dokunuş: yuvaya bas, kule kurulur.
 * Eski webview fallback'i ve pointer capture try/catch'i diğer birimlerle aynı.
 */
import { Layout, UiState } from './layout';
import { State, build, reset } from './state';
import { SLOTS, TD } from './config';
import { audio } from '../../core/audio';

export interface InputHooks {
  onInteract(): void;
  onCta(): void;
  onReset(): void;
}

export function bindInput(cv: HTMLCanvasElement, L: Layout, s: State, ui: UiState, hooks: InputHooks): void {
  function pos(e: MouseEvent | Touch): [number, number] {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /** En yakın yuva — dokunma hedefi hücreden biraz geniş tutuluyor. */
  function slotAt(x: number, y: number): number {
    const [cx, cy] = L.cellOf(x, y);
    for (let i = 0; i < SLOTS.length; i++) {
      const s0 = SLOTS[i];
      if (cx >= s0[0] - 0.15 && cx <= s0[0] + 1.15 && cy >= s0[1] - 0.15 && cy <= s0[1] + 1.15) return i;
    }
    return -1;
  }

  function down(x: number, y: number): void {
    hooks.onInteract();

    if (L.inRect(L.sound, x, y)) {
      audio.toggle();
      return;
    }

    if (s.status !== 'playing') {
      if (s.endT < TD.celebrateFor) return;
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

    const i = slotAt(x, y);
    if (i >= 0) build(s, i);
  }

  if (window.PointerEvent) {
    cv.addEventListener('pointerdown', (e) => {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        /* yok say */
      }
      const [x, y] = pos(e);
      down(x, y);
    });
  } else {
    cv.addEventListener('touchstart', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      down(x, y);
    });
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = pos(e);
      down(x, y);
    });
  }

  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block as EventListener);
  document.addEventListener('contextmenu', block);
}
