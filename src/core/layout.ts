/**
 * Ekran geometrisi — her iki playable da (2D ve 3D) aynı layout'u kullanıyor.
 *
 * 3D sürümde de tahta AYNI ekran dikdörtgenine oturuyor: kamera z=0 düzlemi
 * piksel birebir olacak şekilde kuruluyor. Böylece hit-test, CTA konumu ve
 * tutorial ipucu tek yerden geliyor, renderer değişince input bozulmuyor.
 */
import { GAME } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  dragFrom: number;
  dragX: number;
  dragY: number;
  hint: [number, number] | null;
}

export class Layout {
  w = 0;
  h = 0;
  dpr = 1;
  board: Rect = { x: 0, y: 0, w: 0, h: 0 };
  cell = 0;
  gap = 0;
  cta: Rect = { x: 0, y: 0, w: 0, h: 0 };
  spawnBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Kapanış kartındaki TRY AGAIN — spawn butonuyla aynı yuvayı kullanıyor. */
  secondary: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Ses aç/kapat, sağ üst köşe. Üç referansta da vardı. */
  sound: Rect = { x: 0, y: 0, w: 0, h: 0 };

  update(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    this.w = w;
    this.h = h;
    this.dpr = dpr;

    const pad = Math.max(12, h * 0.028);
    const ctaH = Math.min(Math.max(52, h * 0.075), 72);
    const ctaW = Math.min(w * 0.86, 440);
    this.cta = { x: (w - ctaW) / 2, y: h - ctaH - pad, w: ctaW, h: ctaH };

    const spH = Math.min(Math.max(38, h * 0.05), 50);
    const spW = Math.min(w * 0.54, 250);
    this.spawnBtn = { x: (w - spW) / 2, y: this.cta.y - spH - pad * 0.55, w: spW, h: spH };

    this.secondary = { x: this.spawnBtn.x, y: this.spawnBtn.y, w: this.spawnBtn.w, h: this.spawnBtn.h };

    const sd = Math.min(Math.max(34, h * 0.045), 44);
    this.sound = { x: w - sd - Math.max(12, w * 0.035), y: Math.max(12, h * 0.022), w: sd, h: sd };

    const headerH = Math.min(Math.max(76, h * 0.15), 150);
    const availH = this.spawnBtn.y - headerH - pad * 0.5;
    const size = Math.max(120, Math.min(w * 0.92, availH));
    this.board = { x: (w - size) / 2, y: headerH + (availH - size) / 2, w: size, h: size };
    this.gap = size * 0.028;
    this.cell = (size - this.gap * (GAME.cols + 1)) / GAME.cols;
  }

  cellRect(i: number): Rect {
    const c = i % GAME.cols;
    const r = (i / GAME.cols) | 0;
    return {
      x: this.board.x + this.gap + c * (this.cell + this.gap),
      y: this.board.y + this.gap + r * (this.cell + this.gap),
      w: this.cell,
      h: this.cell,
    };
  }

  cellCenter(i: number): [number, number] {
    const r = this.cellRect(i);
    return [r.x + r.w / 2, r.y + r.h / 2];
  }

  cellAt(x: number, y: number): number {
    const rx = x - this.board.x - this.gap;
    const ry = y - this.board.y - this.gap;
    const step = this.cell + this.gap;
    const c = Math.floor(rx / step);
    const r = Math.floor(ry / step);
    if (c < 0 || r < 0 || c >= GAME.cols || r >= GAME.rows) return -1;
    if (rx - c * step > this.cell + this.gap * 0.6) return -1;
    if (ry - r * step > this.cell + this.gap * 0.6) return -1;
    return r * GAME.cols + c;
  }

  inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
