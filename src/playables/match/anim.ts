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

/**
 * Bu taşın ait olduğu eşleşmenin merkezi.
 *
 * Aynı satırdaki ve aynı sütundaki temizlenen taşlar toplanıyor; hangisi
 * daha kalabalıksa eşleşme o yöndedir. L ve T biçimli temizliklerde köşe
 * taşı iki gruba da ait oluyor ve o zaman ikisinin ortalaması alınıyor —
 * görsel olarak da doğrusu bu.
 */
function groupCenter(s: State, i: number, col: number, row: number): [number, number] {
  let hn = 0;
  let hs = 0;
  let vn = 0;
  let vs = 0;
  for (const j of s.clearing) {
    const jc = j % M.cols;
    const jr = (j / M.cols) | 0;
    if (jr === row) {
      hn++;
      hs += jc;
    }
    if (jc === col) {
      vn++;
      vs += jr;
    }
  }
  const cc = hn > 1 ? hs / hn : col;
  const cr = vn > 1 ? vs / vn : row;
  return [cc, cr];
}

/**
 * Bu temizlikteki AYRI eşleşmelerin merkezleri.
 *
 * Bir hamle birbirinden uzak iki eşleşmeyi birden temizleyebiliyor; füzyon
 * şimşeği o zaman iki ayrı yerde patlamalı. Aynı merkeze düşen taşlar
 * yuvarlanmış anahtarla tekilleştiriliyor.
 */
export function clearCenters(s: State): Array<[number, number]> {
  const seen: Record<string, boolean> = {};
  const out: Array<[number, number]> = [];
  for (const i of s.clearing) {
    const c = groupCenter(s, i, i % M.cols, (i / M.cols) | 0);
    const key = c[0].toFixed(1) + ',' + c[1].toFixed(1);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(c);
  }
  return out;
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
    // FÜZYON. Önceden taşlar oldukları yerde büyüyüp sönüyordu: "silindi"
    // bilgisi geliyordu ama BİRLEŞTİKLERİ görünmüyordu. Şimdi eşleşmenin
    // ortasına doğru çekilip orada büyüyorlar ve tek bir noktada
    // patlıyorlar — üç taşın bir şeye dönüştüğü his, match-3'ün bütün
    // ödülü zaten o.
    //
    // Merkez, TAŞIN KENDİ HİZASINDAN çıkıyor: aynı satır ya da sütondaki
    // temizlenen taşların ortalaması. Bütün `clearing` dizisinin ortalaması
    // yanlıştı — bir hamlede birbirinden uzak iki eşleşme birden
    // temizlenebiliyor ve o zaman taşlar tahtanın ortasına doğru
    // kayıyordu.
    const [cc, cr] = groupCenter(s, i, col, row);
    const pull = p < 0.6 ? easeOut(p / 0.6) * 0.85 : 0.85 + ((p - 0.6) / 0.4) * 0.15;
    v.col = col + (cc - col) * pull;
    v.row = row + (cr - row) * pull;
    v.scale = p < 0.3 ? 1 + p * 1.15 : Math.max(0, 1.34 - (p - 0.3) * 1.92);
    v.alpha = p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
    return v;
  }

  // fall
  const p = easeOut(Math.min(1, s.phaseT / M.fallFor));
  const src = s.fallSrc[i];
  if (src === row) return v;
  v.row = src + (row - src) * p;
  return v;
}
