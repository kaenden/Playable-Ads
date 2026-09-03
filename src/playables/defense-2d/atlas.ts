/**
 * defense-2d'ye özel atlas yardımcısı.
 *
 * Genel kırpma/desen işleri `core/atlas.ts`'e taşındı; burada sadece bu
 * paketin rakam sprite'larıyla sayı yazan fonksiyon kaldı.
 */
import { draw, frameOf } from '../../core/atlas';
export { loadAtlas, ready, draw, pattern } from '../../core/atlas';

/**
 * Sayıyı paketin KENDİ rakam sprite'larıyla yazar.
 *
 * Sistem fontu HUD'u "web sayfası" gibi gösteriyordu; bu sette hazır bir
 * rakam seti var ve onu kullanmak reklamı oyunun içinden çıkmış gibi
 * gösteriyor. Müşterinin UI kiti geldiğinde de yol tam olarak bu olacak.
 */
export function drawNumber(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  h: number,
  align: 'left' | 'center' | 'right'
): number {
  const NAMES: Record<string, string> = {
    '0': 'd0', '1': 'd1', '2': 'd2', '3': 'd3', '4': 'd4',
    '5': 'd5', '6': 'd6', '7': 'd7', '8': 'd8', '9': 'd9',
    $: 'dollar', '+': 'plus',
  };
  // Rakamlar 128×128 karenin içinde; gerçek genişlikleri trim'den geliyor.
  const adv: number[] = [];
  let total = 0;
  for (const ch of text) {
    const f = frameOf(NAMES[ch]);
    const w = f ? (f.w / f.ow) * h * 1.16 : h * 0.5;
    adv.push(w);
    total += w;
  }
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  for (let i = 0; i < text.length; i++) {
    const name = NAMES[text[i]];
    if (name) draw(g, name, cx + adv[i] / 2, y, h);
    cx += adv[i];
  }
  return total;
}
