/**
 * Giriş — İKİ takas yolu birden destekliyor.
 *
 * Referans match-3 reklamlarının hepsinde ikisi de çalışıyordu ve sebebi
 * belli: sürükleme daha doğal ama parmağı kaydırmadan iki kez dokunan
 * oyuncu da var. Tek yol dayatmak, ilk saniyede kaybedilen izleyici demek.
 *
 * - Sürükle: taşa bas, komşuya doğru kaydır, bırak.
 * - İki dokunuş: bir taşa dokun (seçilir), komşusuna dokun.
 */
import { Layout, UiState } from './layout';
import { State, trySwap, adjacent, reset } from './state';
import { M } from './config';
import { audio } from '../../core/audio';

export interface InputHooks {
  onInteract(): void;
  onCta(): void;
  onReset(): void;
}

export function bindInput(cv: HTMLCanvasElement, L: Layout, s: State, ui: UiState, hooks: InputHooks): void {
  let downCell = -1;
  let downX = 0;
  let downY = 0;

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
      if (s.endT < M.celebrateFor) return;
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

    const i = L.cellAt(x, y);
    if (i < 0) {
      ui.sel = -1;
      return;
    }
    downCell = i;
    downX = x;
    downY = y;

    if (ui.sel >= 0 && adjacent(ui.sel, i)) {
      trySwap(s, ui.sel, i);
      ui.sel = -1;
      downCell = -1;
      return;
    }
    ui.sel = i;
  }

  function move(x: number, y: number): void {
    if (downCell < 0 || s.phase !== 'idle') return;
    const dx = x - downX;
    const dy = y - downY;
    // Eşik hücrenin üçte biri: daha küçüğü dokunuşu yanlışlıkla takas yapıyor.
    const th = L.cell * 0.34;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;

    const col = downCell % M.cols;
    const row = (downCell / M.cols) | 0;
    let tc = col;
    let tr = row;
    if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
    else tr += dy > 0 ? 1 : -1;
    if (tc < 0 || tr < 0 || tc >= M.cols || tr >= M.rows) {
      downCell = -1;
      return;
    }
    trySwap(s, downCell, tr * M.cols + tc);
    ui.sel = -1;
    downCell = -1;
  }

  function up(): void {
    downCell = -1;
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
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      move(x, y);
    });
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  } else {
    cv.addEventListener('touchstart', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      down(x, y);
    });
    cv.addEventListener('touchmove', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      move(x, y);
    });
    cv.addEventListener('touchend', up);
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('mousemove', (e) => {
      const [x, y] = pos(e);
      move(x, y);
    });
    cv.addEventListener('mouseup', up);
  }

  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block as EventListener);
  document.addEventListener('contextmenu', block);
}
