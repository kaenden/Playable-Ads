/**
 * Yön verme — tek parmak, tek eksen.
 *
 * BAĞIL SÜRÜKLEME, mutlak değil. İlk sürüm parmağın ekrandaki x'ini doğrudan
 * koridora eşliyordu; ekranın kenarına dokunulduğunda kalabalık oraya
 * ışınlanıyordu. Bağıl sürüklemede parmağın nereye BASTIĞI değil, ne kadar
 * KAYDIĞI önemli — nereye dokunulursa dokunulsun kontrol aynı.
 *
 * Duyarlılık ekran genişliğine göre: ekranın %62'sini kat etmek koridoru
 * uçtan uca geçirmeye yetiyor. Piksel cinsinden sabit bir katsayı, dar
 * telefonda oyunu ağır, tablette aşırı hassas yapıyordu.
 *
 * Eski Android WebView'lerde PointerEvent olmayabiliyor (bazı ad SDK
 * container'ları hâlâ eski webview kullanıyor), o yüzden fallback var.
 */
import { Layout, UiState } from './layout';
import { State, steerBy, reset } from './state';
import { audio } from '../../core/audio';
import { RUN } from './config';

export interface InputHooks {
  onInteract(): void;
  onCta(): void;
  onReset(): void;
}

export function bindInput(
  cv: HTMLCanvasElement,
  L: Layout,
  s: State,
  ui: UiState,
  hooks: InputHooks
): void {
  let lastX = 0;
  let active = false;

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
      if (s.endT < RUN.endAfter + RUN.celebrateFor) return;
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

    active = true;
    lastX = x;
    ui.dragging = true;
    ui.hint = false;
  }

  function move(x: number): void {
    if (!active) return;
    const k = (RUN.steerLimit * 2) / (L.w * 0.62);
    steerBy(s, (x - lastX) * k);
    lastX = x;
  }

  function up(): void {
    active = false;
    ui.dragging = false;
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
    cv.addEventListener('pointermove', (e) => move(pos(e)[0]));
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  } else {
    cv.addEventListener('touchstart', (e) => {
      const [x, y] = pos(e.changedTouches[0]);
      down(x, y);
    });
    cv.addEventListener('touchmove', (e) => move(pos(e.changedTouches[0])[0]));
    cv.addEventListener('touchend', up);
    cv.addEventListener('mousedown', (e) => {
      const [x, y] = pos(e);
      down(x, y);
    });
    cv.addEventListener('mousemove', (e) => move(pos(e)[0]));
    cv.addEventListener('mouseup', up);
  }

  // Ad container içinde sayfa kaydırma / zoom asla olmamalı.
  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block as EventListener);
  document.addEventListener('contextmenu', block);
}
