import { GAME } from '../../core/config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintPair, tryMove } from '../../core/state';
import { UiState } from '../../core/layout';
import { bindInput } from '../../core/input';
import { audio } from '../../core/audio';
import { sprite, loadArt } from '../../core/art';
import { View2D } from './view2d';

const cv = document.getElementById('c') as HTMLCanvasElement;
const state = createState();
const ui: UiState = { dragFrom: -1, dragX: 0, dragY: 0, hint: null };

let view: View2D;
let last = 0;
let idle = 0;
let paused = false;
let autoPlayed = false;

function start(): void {
  view = new View2D(cv);
  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  bindInput(cv, view.L, state, ui, {
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

  // Time-to-fun = 0. State.io teardown'ından (Sample Ads/01-...) alınan ders:
  // referans reklam ilk karede zaten oynanıyor ve el ilk hamleyi gösteriyor.
  ui.hint = hintPair(state);

  // QA hook'u: sadece preview build'inde var. __AD_NETWORK__ derleme zamanı
  // sabiti olduğu için ağ paketlerinde bu blok minify sırasında tamamen siliniyor.
  if (__AD_NETWORK__ === 'preview') {
    (window as unknown as Record<string, unknown>).__pl = { state, view, ui, sprite, L: view.L };
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

  // TikTok'un önerdiği davranış: uzun süre dokunulmazsa sahneyi kendin ilerlet.
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
ad.init(() => { loadArt().then(start); });
