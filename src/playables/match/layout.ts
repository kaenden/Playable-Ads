/**
 * Ekran geometrisi — İKİ renderer da bunu kullanıyor.
 *
 * merge'de olduğu gibi tahta aynı ekran dikdörtgenine oturuyor; 3D sürümde
 * kamera o dikdörtgene tam oturtuluyor (escape-3d'deki ortografik fit).
 * Böylece hit-test, HUD ve tutorial tek yerden geliyor.
 */
import { M } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  /** Seçili taş; -1 seçim yok. */
  sel: number;
  /** Tutorial'ın gösterdiği takas. */
  hint: [number, number] | null;
}

export class Layout {
  w = 0;
  h = 0;
  dpr = 1;
  board: Rect = { x: 0, y: 0, w: 0, h: 0 };
  cell = 0;
  cta: Rect = { x: 0, y: 0, w: 0, h: 0 };
  secondary: Rect = { x: 0, y: 0, w: 0, h: 0 };
  sound: Rect = { x: 0, y: 0, w: 0, h: 0 };
  headerBottom = 0;

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

    const sh = Math.min(Math.max(38, h * 0.05), 50);
    const sw = Math.min(w * 0.54, 250);
    this.secondary = { x: (w - sw) / 2, y: this.cta.y - sh - pad * 0.55, w: sw, h: sh };

    const sd = Math.min(Math.max(34, h * 0.045), 44);
    this.sound = { x: w - sd - Math.max(12, w * 0.035), y: Math.max(12, h * 0.022), w: sd, h: sd };

    // Başlık bloğu gerçekte ~105 px; 0.165 fazla pay bırakıp tahtayla
    // arasında boş bir bant oluşturuyordu.
    this.headerBottom = Math.min(Math.max(92, h * 0.14), 150);

    const top = this.headerBottom;
    const bottom = this.cta.y - pad * 0.7;
    const availW = w * 0.96;
    const availH = Math.max(180, bottom - top);
    this.cell = Math.min(availW / M.cols, availH / M.rows);
    const bw = this.cell * M.cols;
    const bh = this.cell * M.rows;
    // 6 sütun dar ekranda genişlikten sınırlanıyor, yani dikeyde bol pay
    // kalıyor. Payı yukarı toplamak tahtayı başlığa yaklaştırıyor ve altta
    // tutorial etiketi + CTA için yer bırakıyor.
    this.board = { x: (w - bw) / 2, y: top + (availH - bh) * 0.28, w: bw, h: bh };
  }

  /** Hücre merkezi (piksel). Satır kesirli verilebilir — düşüş animasyonu için. */
  center(col: number, row: number): [number, number] {
    return [this.board.x + (col + 0.5) * this.cell, this.board.y + (row + 0.5) * this.cell];
  }

  cellAt(x: number, y: number): number {
    const c = Math.floor((x - this.board.x) / this.cell);
    const r = Math.floor((y - this.board.y) / this.cell);
    if (c < 0 || r < 0 || c >= M.cols || r >= M.rows) return -1;
    return r * M.cols + c;
  }

  inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
