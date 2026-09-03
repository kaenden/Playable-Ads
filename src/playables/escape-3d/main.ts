import { LOT } from './config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintCar, tap, freeCars } from './state';
import { UiState } from './layout';
import { bindInput } from './input';
import { audio } from '../../core/audio';
import { sfx } from './sfx';
import { loadModels } from './models';
import { View3D } from './view3d';
import { View2D } from './view2d';
import { EscapeView } from './view';

/**
 * WebGL yoksa BOŞ EKRAN gösterilemez — merge-3d'de koyduğumuz kural.
 * Ad container'larının bir kısmı hâlâ WebGL'siz çalışıyor; orada
 * `new WebGLRenderer()` patlıyor, reklam beyaz kalıyor, CTA hiç görünmüyor.
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
const ui: UiState = { hint: 0, press: -1 };

let view: EscapeView;
let last = 0;
let idle = 0;
let paused = false;
let autoPlayed = false;
let tickedAt = -1;

function start(): void {
  const mode = webglOk() ? 'webgl' : 'WEBGL_FALLBACK';
  (window as unknown as Record<string, string>).__renderMode = mode;
  view = mode === 'webgl' ? new View3D(gl) : new View2D(gl);

  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  bindInput(view.cv, view.L, view, state, ui, {
    onInteract() {
      idle = 0;
      ui.hint = 0;
      // Saat ilk gerçek dokunuşta başlıyor (bkz. state.tick).
      state.started = true;
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
      idle = 0;
      autoPlayed = false;
      tickedAt = -1;
      ui.hint = 0;
    },
  });

  ad.onVisibility((v) => {
    paused = !v;
    last = 0;
  });

  const h = hintCar(state);
  ui.hint = h ? h.id : 0;

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
  if (idle > LOT.idleHintAfter && state.status === 'playing' && !ui.hint) {
    const h = hintCar(state);
    ui.hint = h ? h.id : 0;
  }

  // TikTok önerisi: hareketsizlikte sahneyi kendin ilerlet. Bunu yaparken
  // SAAT BAŞLATILMIYOR — oyuncu hâlâ dokunmadı, izlenimi yakmamalıyız.
  if (!autoPlayed && idle > LOT.autoAdvanceAfter && state.status === 'playing') {
    const free = freeCars(state)[0];
    if (free) {
      tap(state, free.row * state.cols + free.col);
      autoPlayed = true;
      idle = 0;
      ui.hint = 0;
    }
  }

  // Son 5 saniyede saniye başına tik — baskıyı kulakla da duyur.
  if (state.status === 'playing' && state.started && state.time <= 5) {
    const sec = Math.ceil(state.time);
    if (sec !== tickedAt) {
      tickedAt = sec;
      sfx.tick();
    }
  }

  for (const ev of drainEvents(state)) {
    if (ev.type === 'drive' && ev.car) {
      view.drive(ev.car);
      sfx.drive();
      ui.hint = 0;
      idle = 0;
    } else if (ev.type === 'blocked' && ev.car && ev.blocker) {
      view.bump(ev.car, ev.blocker);
      sfx.horn();
      idle = 0;
    } else if (ev.type === 'win') {
      sfx.win();
    } else if (ev.type === 'lose') {
      sfx.lose();
    }
  }

  view.render(state, ui, dt);
}

// Asset yolunda modeller yüklenmeden ilk kare çizilmemeli.
//
// Koşul ÇAĞRI YERİNDE ve sabite DOĞRUDAN bakıyor. `loadModels()` koşulsuz
// çağrılınca fonksiyonun içindeki erken dönüş esbuild'e yetmedi: GLTFLoader
// prosedürel pakete de girdi ve escape-3d 583 -> 663 KB oldu. Bu projede
// üçüncü kez aynı tuzak (CTA dalları, modelFor, şimdi bu): sabit
// karşılaştırması tüketildiği yerde durmalı, bir fonksiyonun içinde değil.
ad.init(() => {
  const jobs: Array<Promise<void>> = [];
  if (__ART__ === 'atlas') jobs.push(loadModels());
  Promise.all(jobs).then(start);
});
