import { M } from './config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintSwap, trySwap } from './state';
import { UiState } from './layout';
import { bindInput } from './input';
import { audio } from '../../core/audio';
import { sfx } from './sfx';
import { loadAtlas } from '../../core/atlas';
import { loadModels } from './models';
import { View3D } from './view3d';
import { View2D } from './view2d';

const cv = document.getElementById('c') as HTMLCanvasElement;
const state = createState();
const ui: UiState = { sel: -1, hint: null };

/**
 * WebGL yoksa BOŞ EKRAN gösterilemez — projedeki 3D birimlerin kuralı.
 * Burada yedek özellikle ucuz: 2D sürüm zaten var ve AYNI sanatı kullanıyor,
 * yani düşüş görsel olarak neredeyse fark ettirmiyor.
 */
function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

let view: View3D | View2D;
let last = 0;
let idle = 0;
let paused = false;
let autoPlayed = false;

function start(): void {
  const mode = webglOk() ? 'webgl' : 'WEBGL_FALLBACK';
  (window as unknown as Record<string, string>).__renderMode = mode;
  view = mode === 'webgl' ? new View3D(cv) : new View2D(cv);
  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  bindInput(view.cv, view.L, state, ui, {
    onInteract() {
      idle = 0;
      ui.hint = null;
      state.started = true;
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
      idle = 0;
      autoPlayed = false;
      ui.sel = -1;
      ui.hint = null;
    },
  });

  ad.onVisibility((v) => {
    paused = !v;
    last = 0;
  });

  ui.hint = hintSwap(state);

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
  if (idle > M.idleHintAfter && state.status === 'playing' && state.phase === 'idle' && !ui.hint) {
    ui.hint = hintSwap(state);
  }
  if (!autoPlayed && idle > M.autoAdvanceAfter && state.status === 'playing' && state.phase === 'idle') {
    const pair = hintSwap(state);
    if (pair) {
      state.started = true;
      trySwap(state, pair[0], pair[1]);
      autoPlayed = true;
      idle = 0;
      ui.hint = null;
    }
  }

  for (const ev of drainEvents(state)) {
    if (ev.type === 'clear' && ev.cells) {
      for (const i of ev.cells) view.burstAt(i, state.cells[i] < 0 ? 0 : state.cells[i]);
      // Zincir derinleştikçe perde yükseliyor: cascade kulakla da duyuluyor.
      sfx.clear(ev.chain || 1);
      if ((ev.chain || 1) >= 3) view.fx.shake = Math.max(view.fx.shake, view.L.h * 0.006);
      ui.hint = null;
      idle = 0;
    } else if (ev.type === 'swap') {
      sfx.swap();
    } else if (ev.type === 'reject') {
      sfx.reject();
    } else if (ev.type === 'win') {
      sfx.win();
    } else if (ev.type === 'lose') {
      sfx.lose();
    }
  }

  view.render(state, ui, dt);
}

// Hem modeller hem HUD atlası hazır olmadan ilk kare çizilmemeli.
ad.init(() => {
  Promise.all([loadAtlas(), loadModels()]).then(start);
});


