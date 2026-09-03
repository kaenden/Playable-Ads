/**
 * Taşın o anki GÖRSEL konumu — iki renderer da bunu kullanıyor.
 *
 * Deneyin bütün anlamı burada: 2D ve 3D sürüm aynı state'i, aynı animasyon
 * zamanlamasını ve aynı eğrileri paylaşıyor. Aralarındaki tek fark çizim.
 * Animasyonu iki kere yazsaydım karşılaştırma "hangisi daha iyi yazılmış"a
 * dönerdi; asıl ölçmek istediğim renderer'ın bedeli.
 */
import { M } from './config';
import { State } from './state';

export interface Vis {
  /** Hücre koordinatı, kesirli. */
  col: number;
  row: number;
  scale: number;
  alpha: number;
}

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export function visual(s: State, i: number): Vis {
  const col = i % M.cols;
  const row = (i / M.cols) | 0;
  const v: Vis = { col, row, scale: 1, alpha: 1 };
  if (s.phase === 'idle') return v;

  if (s.phase === 'swap' || s.phase === 'back') {
    if (i !== s.swapA && i !== s.swapB) return v;
    const other = i === s.swapA ? s.swapB : s.swapA;
    const oc = other % M.cols;
    const or = (other / M.cols) | 0;
    const p = Math.min(1, s.phaseT / M.swapFor);
    // Reddedilen takas gidip GERİ dönüyor; geçerli olan gittiği yerde kalıyor.
    const k = s.phase === 'swap' ? p : p < 0.5 ? p * 2 : (1 - p) * 2;
    // cells[] zaten takaslı: taş KARŞI hücreden başlayıp kendi hücresine gidiyor.
    v.col = col + (1 - k) * (oc - col);
    v.row = row + (1 - k) * (or - row);
    return v;
  }

  if (s.phase === 'clear') {
    if (s.clearing.indexOf(i) < 0) return v;
    const p = Math.min(1, s.phaseT / M.clearFor);
    // Önce hafif büyüyüp sonra sönüyor: doğrudan küçülmek "silindi" gibi
    // duruyordu, ödül hissi vermiyordu.
    v.scale = p < 0.25 ? 1 + p * 1.2 : Math.max(0, 1.3 - (p - 0.25) * 1.73);
    v.alpha = p < 0.5 ? 1 : 1 - (p - 0.5) * 2;
    return v;
  }

  // fall
  const p = easeOut(Math.min(1, s.phaseT / M.fallFor));
  const src = s.fallSrc[i];
  if (src === row) return v;
  v.row = src + (row - src) * p;
  return v;
}
