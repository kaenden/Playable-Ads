/**
 * Renderer'dan bağımsız 2D çizim yardımcıları.
 *
 * Bunlar art.ts'in içindeydi. Üçüncü playable HUD'unda da lazım oldu, ama
 * art.ts'i import etmek bütün merge sprite üreticisini (dragon, kanat, yumurta
 * çizimi — 500 satır) yeni bundle'a sokuyordu. Kullanılmayan kod tree-shaking'e
 * takılmıyor çünkü sprite() cache üzerinden çağrılıyor.
 *
 * Ders: paylaşılan dosya, en ağır kullanıcısının boyutunu her ithal edene
 * ödetiyor. Ortak olan şey ayrı dosyaya çıkmalı.
 */

/** Oyun yazılarının varsayılan kontur rengi. */
export const OUTLINE = '#180f2e';

/**
 * Oyun yazısı: kalın koyu kontur + dikey gradient dolgu.
 * Referans kreatiflerdeki bütün metin böyle; düz sistem fontu "web app" gibi
 * okunuyordu. Font ve textAlign çağrıdan ÖNCE ayarlanmış olmalı.
 */
export function outlinedText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  c1: string,
  c2: string,
  outline?: string
): void {
  g.save();
  g.lineJoin = 'round';
  g.miterLimit = 2;
  g.shadowColor = 'rgba(6,3,20,.55)';
  g.shadowBlur = size * 0.22;
  g.shadowOffsetY = size * 0.08;
  g.strokeStyle = outline || OUTLINE;
  g.lineWidth = Math.max(2, size * 0.2);
  g.strokeText(text, x, y);
  g.restore();

  const grd = g.createLinearGradient(0, y - size * 0.62, 0, y + size * 0.52);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillText(text, x, y);
}

export function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** Metni verilen genişliğe sığana kadar küçültür — dar telefonda taşmayı önler. */
export function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  weight: string,
  px: number,
  font: string
): void {
  let size = px;
  do {
    g.font = weight + ' ' + Math.round(size) + 'px ' + font;
    if (g.measureText(text).width <= maxW) break;
    size -= 1;
  } while (size > 9);
}
