import { M, COPY } from './config';
import { ad } from '../../core/ad';
import { createState, tick, drainEvents, hintSwap, trySwap } from './state';
import { UiState } from './layout';
import { bindInput } from './input';
import { audio } from '../../core/audio';
import { sfx } from './sfx';
import { loadAtlas } from '../../core/atlas';
import { View2D } from './view2d';
import { clearCenters } from './anim';
import { chainWord } from './look';

const cv = document.getElementById('c') as HTMLCanvasElement;
const state = createState();
const ui: UiState = { sel: -1, hint: null };

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
      const chain = ev.chain || 1;
      for (const i of ev.cells) view.burstAt(i, state.cells[i] < 0 ? 0 : state.cells[i], chain);
      // FÜZYON ŞİMŞEĞİ, eşleşmenin merkezinde. Taşlar oraya doğru
      // çekildiği için patlama da orada olmalı; hücre hücre patlatmak
      // "üçü birden yok oldu" diyor, merkezdeki tek şimşek "üçü BİRLEŞTİ".
      for (const [cc, cr] of clearCenters(state)) view.flashAt(cc, cr, chain);
      // Özel füzyonlar: roket ışını ve bomba. Zincir sözünden ÖNCE
      // tetikleniyor ki ekranda önce patlama, sonra söz olsun.
      if (ev.blasts) for (const b of ev.blasts) view.blastAt(b);
      const word = chainWord(chain);
      if (word) view.hud.combo(word);
      // Zincir derinleştikçe perde yükseliyor: cascade kulakla da duyuluyor.
      sfx.clear(chain);
      // Sarsıntı da zincirle büyüyor; ilk temizlikte yok, çünkü her
      // hamlede sarsılan bir ekran kısa sürede yorucu oluyor.
      if (chain >= 2) {
        view.fx.shake = Math.max(view.fx.shake, view.L.h * 0.004 * Math.min(4, chain));
      }
      ui.hint = null;
      idle = 0;
    } else if (ev.type === 'stage') {
      // Sipariş tamam, yenisi geldi. Kazanma sesi ve büyük bir duyuru:
      // oyuncu bitirdiğini ve devam ettiğini aynı anda anlamalı.
      view.hud.combo(COPY.nextOrder, 1.5);
      view.fx.burst(view.L.w / 2, view.L.board.y + view.L.board.h * 0.4,
        view.L.cell * 1.3, 6, '#FFE45F');
      view.fx.shake = Math.max(view.fx.shake, view.L.h * 0.012);
      sfx.clear(4);
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

// Atlas bu birimin sanatının tamamı: yüklenmeden ilk kare çizilmemeli.
ad.init(() => {
  loadAtlas().then(start);
});


