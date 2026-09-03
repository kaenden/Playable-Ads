import { ad } from '../../core/ad';
import { createState, tick, drainEvents } from './state';
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
let paused = false;

function start(): void {
  const mode = webglOk() ? 'webgl' : 'WEBGL_FALLBACK';
  (window as unknown as Record<string, string>).__renderMode = mode;
  view = mode === 'webgl' ? new View3D(gl) : new View2D(gl);
  if (mode === 'webgl') (view as View3D).setStepCallback(() => sfx.step());

  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 120));

  bindInput(view.cv, view.L, state, ui, {
    onInteract() {
      state.started = true;
      audio.unlock();
    },
    onCta() {
      ad.install();
    },
    onReset() {
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

/*
 * OTOMATİK OYNATMA KALDIRILDI.
 *
 * Önceden, dokunulmazsa oyun kendi kendine doğru kapıya yöneliyordu —
 * gerekçesi "izleyici mekaniği hiç olmazsa bir kez görsün"dü. Yanlış
 * gerekçeydi: kendi kendini kusursuz oynayan bir reklam VİDEO gibi
 * okunuyor. İzleyici bir şey yapması gerektiğini anlamıyor, parmağını
 * hiç kaldırmıyor ve playable'ın videodan tek farkı ortadan kalkıyor.
 *
 * Dokunulmadığında kalabalık şeridin ortasından düz gidiyor. Parkur bunu
 * hesaba katarak kuruldu: ortadan giden bir koşu kapıların SAĞ tarafını
 * alıyor ve o taraf sırayla kötü / iyi / kötü / iyi — yani izleyici hem
 * bir yeşil hem bir kırmızı sonuç görüyor, sonra 16 kişiyle duvara varıp
 * 24'ü tutturamıyor. Kaybeden bir açılış kasıtlı: TRY AGAIN ve "you
 * needed 24" kartı, mekaniği kusursuz bir gösteriden daha net anlatıyor.
 * 2026 kreatif metası da bu — az kalsın kaybediyordun.
 */

function loop(now: number): void {
  requestAnimationFrame(loop);
  if (paused) return;

  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  tick(state, dt);

  for (const ev of drainEvents(state)) {
    if (ev.type === 'gate') {
      view.gate(ev.good, ev.label);
      if (ev.good) sfx.gain();
      else sfx.loss();
    } else if (ev.type === 'hurt') {
      view.hurt(ev.n);
      sfx.crush();
    } else if (ev.type === 'kill') {
      view.kill(ev.x, ev.z);
      sfx.step();
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
