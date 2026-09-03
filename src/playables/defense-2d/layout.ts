/**
 * Ekran geometrisi. Hücre ölçüsü tek kaynak: simülasyon hücre cinsinden
 * çalışıyor, çizim burada piksele çevriliyor.
 */
import { TD } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  /** Tutorial halkasının gösterdiği yuva; -1 ipucu yok. */
  hint: number;
  /** Parası yetmediği için reddedilen yuva ve kalan sarsıntı süresi. */
  deny: number;
  denyT: number;
}

export class Layout {
  w = 0;
  h = 0;
  dpr = 1;
  /** Oyun alanı — 6×10 ızgara buraya oturuyor. */
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

    this.headerBottom = Math.min(Math.max(92, h * 0.155), 158);

    const top = this.headerBottom;
    const bottom = this.cta.y - pad * 0.6;
    const availW = w * 0.98;
    const availH = Math.max(160, bottom - top);
    // Izgara oranı sabit (6:10); hangi eksen kısıtlıyorsa o belirliyor.
    this.cell = Math.min(availW / TD.cols, availH / TD.rows);
    const bw = this.cell * TD.cols;
    const bh = this.cell * TD.rows;
    this.board = { x: (w - bw) / 2, y: top + (availH - bh) * 0.35, w: bw, h: bh };
  }

  /** Hücre koordinatı -> piksel. */
  px(cx: number, cy: number): [number, number] {
    return [this.board.x + cx * this.cell, this.board.y + cy * this.cell];
  }

  /** Piksel -> hücre koordinatı (kesirli). */
  cellOf(x: number, y: number): [number, number] {
    return [(x - this.board.x) / this.cell, (y - this.board.y) / this.cell];
  }

  inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
