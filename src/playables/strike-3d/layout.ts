/**
 * Ekran geometrisi.
 *
 * Runner'da "tahta" yok — sahne bütün ekranı dolduruyor ve HUD onun üstünde
 * duruyor. O yüzden bu düzen sınıfı sadece DOKUNULABİLİR ve YAZI YAZILAN
 * dikdörtgenleri tanımlıyor; kamera hiçbirine oturtulmuyor.
 *
 * `safeBottom` kritik: CTA butonu ekranın altında, kalabalık da ekranın alt
 * üçte birinde koşuyor. Kamera açısı, kalabalığı CTA'nın üstünde tutacak
 * şekilde bu değere göre ayarlanıyor — yoksa oyuncu kendi ordusunu butonun
 * arkasında arıyor.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  /** Tutorial eli hâlâ görünüyor mu. */
  hint: boolean;
  /** Parmak ekranda mı — tutorial bunu görünce kayboluyor. */
  dragging: boolean;
}

export class Layout {
  w = 0;
  h = 0;
  dpr = 1;
  cta: Rect = { x: 0, y: 0, w: 0, h: 0 };
  secondary: Rect = { x: 0, y: 0, w: 0, h: 0 };
  sound: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Üst bilgi bloğunun bittiği y. */
  headerBottom = 0;
  /** CTA'nın üst kenarı — sahne bunun üstünde kalmalı. */
  safeBottom = 0;

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

    this.headerBottom = Math.min(Math.max(92, h * 0.16), 156);
    this.safeBottom = this.cta.y - pad * 0.4;
  }

  inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
