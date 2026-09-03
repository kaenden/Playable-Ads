/**
 * Pointer + touch girişi. Layout'a bağlı, renderer'dan bağımsız —
 * 2D ve 3D playable aynı dosyayı kullanıyor.
 *
 * Eski Android WebView'lerde PointerEvent olmayabiliyor (bazı ad SDK
 * container'ları hâlâ eski webview kullanıyor), o yüzden fallback var.
 */
import { Layout, UiState } from './layout';
import { State, tryMove, spawn, reset } from './state';
import { audio } from './audio';
import { GAME } from './config';

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

  function down(x: number, y: number): void {
    hooks.onInteract();

    // Ses toggle'ı her durumda çalışır.
    if (L.inRect(L.sound, x, y)) {
      audio.toggle();
      return;
    }

    if (s.status !== 'playing') {
      // Kutlama sahnesinde hiçbir buton yok — ödül anı kesilmiyor.
      if (s.endT < GAME.celebrateFor) return;
      if (L.inRect(L.secondary, x, y)) {
        reset(s);
        hooks.onReset();
        return;
      }
      if (L.inRect(L.cta, x, y)) hooks.onCta();
      // Boşluğa dokunmak artık install saymıyor: referansların üçü de
      // açık buton kullanıyor, "her yere dokun = install" kullanıcıyı kandırıyor.
      return;
    }
    if (L.inRect(L.cta, x, y)) {
      hooks.onCta();
      return;
    }
    if (L.inRect(L.spawnBtn, x, y)) {
      spawn(s);
      return;
    }
    const i = L.cellAt(x, y);
    if (i >= 0 && s.cells[i]) {
      ui.dragFrom = i;
      ui.dragX = x;
      ui.dragY = y;
    }
  }

  function move(x: number, y: number): void {
    if (ui.dragFrom < 0) return;
    ui.dragX = x;
    ui.dragY = y;
  }

  function up(x: number, y: number): void {
    if (ui.dragFrom < 0) return;
    const target = L.cellAt(x, y);
    if (target >= 0) tryMove(s, ui.dragFrom, target);
    ui.dragFrom = -1;
  }

  if (window.PointerEvent) {
    cv.addEventListener('pointerdown', (e) => {
      // Bazı webview'larda ve sentetik (QA) event'lerde capture atıyor;
      // pointer capture olmadan da oyun çalışmalı.
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        /* yok say */
      }
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      move(x, y);
    });
    const end = (e: PointerEvent) => {
      const [x, y] = pos(e);
      up(x, y);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  } else {
    cv.addEventListener('touchstart', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      down(x, y);
    });
    cv.addEventListener('touchmove', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      move(x, y);
    });
    cv.addEventListener('touchend', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      up(x, y);
    });
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('mousemove', (e) => {
      const [x, y] = pos(e);
      move(x, y);
    });
    cv.addEventListener('mouseup', (e) => {
      const [x, y] = pos(e);
      up(x, y);
    });
  }

  // Ad container içinde sayfa kaydırma / zoom asla olmamalı.
  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block as EventListener);
  document.addEventListener('contextmenu', block);
}
