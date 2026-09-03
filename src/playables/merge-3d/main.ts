import { GAME } from '../../core/config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintPair, tryMove } from '../../core/state';
import { UiState } from '../../core/layout';
import { bindInput } from '../../core/input';
import { audio } from '../../core/audio';
import { loadArt } from '../../core/art';
import { loadModels } from './models';
import { View3D } from './view3d';
import { View2D } from '../merge-2d/view2d';

/**
 * WebGL yoksa BOŞ EKRAN gösterilemez.
 *
 * Ad container'larının bir kısmı hâlâ WebGL'i kapalı ya da eski bir webview
 * kullanıyor. `new WebGLRenderer()` orada exception atıyor ve reklam beyaz
 * kalıyor — impression yanıyor, CTA hiç görünmüyor. Bu yüzden 3D birim,
 * WebGL bulunamazsa 2D renderer'a düşüyor: oyun oynanabilir kalıyor,
 * CTA çalışıyor. Bedeli ~10 KB, karşılığı sıfırlanmış bir kreatif riski.
 */
function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

const gl = document.getElementById('c') as HTMLCanvasElement;
const state = createState();
const ui: UiState = { dragFrom: -1, dragX: 0, dragY: 0, hint: null };

let view: View3D | View2D;
let last = 0;
let idle = 0;
let paused = false;
let autoPlayed = false;

function start(): void {
  const mode = webglOk() ? 'webgl' : 'WEBGL_FALLBACK';
  // QA ve analitik için hangi yolun çalıştığı okunabilir kalsın.
  (window as unknown as Record<string, string>).__renderMode = mode;
  view = mode === 'webgl' ? new View3D(gl) : new View2D(gl);
  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  // Input HUD canvas'ına bağlanıyor — WebGL canvas'ının üstündeki katman o.
  bindInput(view.cv, view.L, state, ui, {
    onInteract() {
      idle = 0;
      ui.hint = null;
      state.started = true;
      // Ses context'i ilk dokunuşta açılıyor: ağlar etkileşim öncesi ses
      // istemiyor, tarayıcı da gesture olmadan izin vermiyor.
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
      idle = 0;
      autoPlayed = false;
      ui.hint = hintPair(state);
    },
  });

  ad.onVisibility((v) => {
    paused = !v;
    last = 0;
  });

  ui.hint = hintPair(state);

  if (__AD_NETWORK__ === 'preview') {
    (window as unknown as Record<string, unknown>).__pl = { state, view, ui, L: view.L };
  }

  requestAnimationFrame(loop);
}

function loop(now: number): void {
  requestAnimationFrame(loop);
  if (paused) return;

  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  tick(state, dt);

  idle += dt;
  if (idle > GAME.idleHintAfter && state.status === 'playing' && ui.dragFrom < 0) {
    if (!ui.hint) ui.hint = hintPair(state);
  }

  if (!autoPlayed && idle > GAME.autoAdvanceAfter && state.status === 'playing') {
    const pair = hintPair(state);
    if (pair) {
      tryMove(state, pair[0], pair[1]);
      autoPlayed = true;
      idle = 0;
      ui.hint = null;
    }
  }

  for (const ev of drainEvents(state)) {
    if (ev.type === 'merge' && ev.index !== undefined && ev.level !== undefined) {
      view.burst(ev.index, ev.level);
      audio.merge(ev.level);
      ui.hint = null;
      idle = 0;
    } else if (ev.type === 'spawn' && ev.index !== undefined) {
      view.burst(ev.index, 1);
      audio.spawn();
    } else if (ev.type === 'reject') {
      audio.reject();
    } else if (ev.type === 'win') {
      audio.win();
    } else if (ev.type === 'lose') {
      audio.lose();
    }
  }

  view.render(state, ui, dt);
}

// Atlas modunda görsel yüklenmeden ilk kare çizilmemeli.
ad.init(() => {
  const jobs = [loadArt()];
  if (__ART__ === 'atlas') jobs.push(loadModels());
  Promise.all(jobs).then(start);
});
