import { TD } from './config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintSlot, build } from './state';
import { UiState } from './layout';
import { bindInput } from './input';
import { audio } from '../../core/audio';
import { sfx } from './sfx';
import { loadAtlas } from './atlas';
import { View2D } from './view2d';

const cv = document.getElementById('c') as HTMLCanvasElement;
const state = createState();
const ui: UiState = { hint: -1, deny: -1, denyT: 0 };

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
      ui.hint = -1;
      // Dalga ilk gerçek dokunuşta başlıyor.
      state.started = true;
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
      idle = 0;
      autoPlayed = false;
      ui.hint = hintSlot(state);
      ui.deny = -1;
      ui.denyT = 0;
    },
  });

  ad.onVisibility((v) => {
    paused = !v;
    last = 0;
  });

  ui.hint = hintSlot(state);

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
  if (ui.denyT > 0) ui.denyT -= dt;

  if (idle > TD.idleHintAfter && state.status === 'playing' && ui.hint < 0) {
    ui.hint = hintSlot(state);
  }

  // Hareketsizlikte sahneyi kendin ilerlet. Burada auto-advance'in ekstra bir
  // görevi var: bu birim gerçek zamanlı, dokunulmazsa dalga hiç başlamıyor ve
  // ekran donuk kalıyor. Bir kule kurmak hem oynanışı hem hareketi gösteriyor.
  if (!autoPlayed && idle > TD.autoAdvanceAfter && state.status === 'playing') {
    const slot = hintSlot(state);
    if (slot >= 0) {
      build(state, slot);
      state.started = true;
      autoPlayed = true;
      idle = 0;
      ui.hint = -1;
    }
  }

  for (const ev of drainEvents(state)) {
    if (ev.type === 'build' && ev.slot !== undefined) {
      sfx.build();
      ui.hint = -1;
      idle = 0;
    } else if (ev.type === 'deny' && ev.slot !== undefined) {
      sfx.deny();
      ui.deny = ev.slot;
      ui.denyT = 0.5;
    } else if (ev.type === 'shoot') {
      sfx.shoot(state.t);
    } else if (ev.type === 'kill' && ev.x !== undefined && ev.y !== undefined) {
      const big = ev.kind === 'tank';
      view.burstAt(ev.x, ev.y, big ? '#FFD45F' : '#FF9A4A', big ? 4 : 2);
      if (big) view.fx.shake = Math.max(view.fx.shake, view.L.h * 0.01);
      sfx.kill();
    } else if (ev.type === 'leak' && ev.x !== undefined && ev.y !== undefined) {
      view.burstAt(ev.x, ev.y, '#E8443A', 3);
      view.fx.shake = Math.max(view.fx.shake, view.L.h * 0.012);
      sfx.leak();
    } else if (ev.type === 'win') {
      sfx.win();
    } else if (ev.type === 'lose') {
      sfx.lose();
    }
  }

  view.render(state, ui, dt);
}

// Atlas bu birimin sanatının TAMAMI: yüklenmeden ilk kare çizilmemeli.
ad.init(() => {
  loadAtlas().then(start);
});


