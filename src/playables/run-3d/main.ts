import { RUN, Gate } from './config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, steerBy, nextGate, nextRow, gapCenter } from './state';
import { UiState } from './layout';
import { bindInput } from './input';
import { audio } from '../../core/audio';
import { sfx } from './sfx';
import { loadModels } from './models';
import { View3D } from './view3d';
import { View2D } from './view2d';
import { RunView } from './view';

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
const ui: UiState = { hint: true, dragging: false };

let view: RunView;
let last = 0;
let idle = 0;
let paused = false;
/** Otomatik oynatma bir kez çalışıyor — sonrası oyuncunun. */
let autoPlayed = false;

function start(): void {
  const mode = webglOk() ? 'webgl' : 'WEBGL_FALLBACK';
  (window as unknown as Record<string, string>).__renderMode = mode;
  view = mode === 'webgl' ? new View3D(gl) : new View2D(gl);
  if (mode === 'webgl') (view as View3D).setStepCallback(() => sfx.step());

  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  bindInput(view.cv, view.L, state, ui, {
    onInteract() {
      idle = 0;
      state.started = true;
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
      idle = 0;
      autoPlayed = false;
      ui.hint = true;
      view.reset();
    },
  });

  ad.onVisibility((v) => {
    paused = !v;
    last = 0;
  });

  if (__AD_NETWORK__ === 'preview') {
    (window as unknown as Record<string, unknown>).__pl = { state, view, ui, L: view.L };
  }

  requestAnimationFrame(loop);
}

/**
 * Hareketsizlikte sahneyi kendin ilerlet (TikTok'un açık önerisi).
 *
 * Runner'da bunun ayrı bir zorunluluğu var: parkur oyuncuyu BEKLEMİYOR.
 * Dokunulmazsa kalabalık ilk kapıya gelir ve rastgele bir tarafı seçer;
 * izleyici oyunun ne istediğini hiç anlamadan reklam biter. O yüzden
 * hareketsizken oyun kendi kendine doğru kapıya yöneliyor — izleyici en
 * azından mekaniği bir kez GÖRÜYOR.
 */
function autoSteer(dt: number): void {
  const gate = nextGate(state);
  const row = nextRow(state);
  let want: number | null = null;

  // Hangisi daha yakınsa ona göre yönel.
  const gz = gate ? gate.z : Infinity;
  const rz = row ? row.z : Infinity;
  if (gz < rz && gate) want = goodSide(gate);
  else if (row) want = gapCenter(row);

  if (want === null) return;
  const d = want - state.steer;
  steerBy(state, Math.max(-2.4 * dt, Math.min(2.4 * dt, d)));
}

function goodSide(g: Gate): number {
  const leftBetter = valueOf(g.left) >= valueOf(g.right);
  return leftBetter ? -RUN.steerLimit * 0.6 : RUN.steerLimit * 0.6;
}

function valueOf(o: { kind: string; v: number }): number {
  if (o.kind === 'add') return o.v;
  if (o.kind === 'mul') return o.v * 8;
  if (o.kind === 'sub') return -o.v;
  return -o.v * 8;
}

function loop(now: number): void {
  requestAnimationFrame(loop);
  if (paused) return;

  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  idle += dt;
  if (!state.started && state.status === 'playing') {
    if (idle > RUN.idleHintAfter) autoPlayed = true;
    if (autoPlayed) autoSteer(dt);
  }

  tick(state, dt);

  for (const ev of drainEvents(state)) {
    if (ev.type === 'gate') {
      const d = ev.after - ev.before;
      view.gate(ev.good, (d >= 0 ? '+' : '−') + Math.abs(d));
      if (ev.good) sfx.gain();
      else sfx.loss();
    } else if (ev.type === 'crush') {
      view.crush(ev.n);
      sfx.crush();
    } else {
      view.finish(ev.won);
      if (ev.won) sfx.smash();
      else sfx.lose();
    }
  }

  view.render(state, ui, dt);
}

// Bu birimde asset SEÇENEK DEĞİL, oyunun kendisi: modeller yüklenmeden ilk
// kare çizilmemeli. Yine de `loadModels` başarısız olursa promise çözülüyor
// ve oyun modelsiz de açılıyor — reklam hiçbir koşulda beyaz kalmamalı.
ad.init(() => {
  loadModels().then(start);
});
