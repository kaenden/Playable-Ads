/**
 * Prosedürel sprite üretimi — projede tek bir .png yok.
 *
 * Sebep: 5MB limitinde asset her şeydir ve base64 inline %33 şişirir.
 * Tüm sprite'lar bir kez offscreen canvas'a çizilip cache'leniyor; bundle'a
 * maliyeti sadece bu dosyanın minified kodu.
 *
 * Referans: State.io playable'ı (Sample Ads/01-state-io-mintegral-teardown.md)
 * top-grossing bir hyper-casual'ın ana kreatifini düz vektörle çıkarıyor.
 * Vektör art playable'da yeterli — mesele detay değil, okunabilirlik.
 *
 * Tasarım dili: kalın koyu kontur + doygun dikey gradient + tek highlight.
 * Her seviye bir öncekinden görsel olarak AÇIKÇA farklı olmalı; oyuncu
 * merge'in ilerlediğini tek bakışta görmezse ödül hissi kayboluyor.
 */

export interface LevelSkin {
  name: string;
  c1: string;
  c2: string;
  dark: string;
  glow: string;
}

export const LEVELS: LevelSkin[] = [
  { name: 'Egg', c1: '#fff8e4', c2: '#f0a83f', dark: '#9c5c15', glow: '#ffd077' },
  { name: 'Cracked', c1: '#e8f8ff', c2: '#2f96e8', dark: '#12507f', glow: '#6ecbff' },
  { name: 'Hatchling', c1: '#e6ffd8', c2: '#3fbf46', dark: '#155e1c', glow: '#87ff7d' },
  { name: 'Wyrmling', c1: '#f6e2ff', c2: '#8b34e6', dark: '#3d1178', glow: '#c78bff' },
  { name: 'Dragon', c1: '#fff0b8', c2: '#f0500d', dark: '#7d1f02', glow: '#ffa42b' },
];

// Kontur rengi ve iki cizim yardimcisi draw.ts'e tasindi: ucuncu playable'in
// HUD'u onlari kullaniyor ama bu dosyanin sprite ureticisini istemiyor.
import { OUTLINE } from './draw';
export { outlinedText, roundRect } from './draw';

/**
 * İKİ ART KAYNAĞI, TEK ARAYÜZ.
 *
 * `__ART__` derleme zamanı sabiti: 'proc' prosedürel çizim, 'atlas' ise
 * optimize edilmiş WebP atlasından kırpma. Gerçek müşteri işinde gelen şey
 * atlas oluyor; prosedürel taraf asset gelmediğinde de üretebilmek için duruyor.
 * Kullanılmayan dal minify'da tamamen siliniyor.
 *
 * Atlas verisi build sırasında define ile gömülüyor (assets-lab/out-2d).
 */
interface Frame { x: number; y: number; w: number; h: number; ow: number; oh: number; ox: number; oy: number }

const LEVEL_FRAMES = ['egg', 'cracked', 'hatchling', 'wyrmling', 'dragon'];
let atlasImg: HTMLImageElement | null = null;
let frames: Record<string, Frame> = {};

/** Atlas modunda görsel yüklenene kadar oyun başlamamalı. */
export function loadArt(): Promise<void> {
  if (__ART__ !== 'atlas') return Promise.resolve();
  return new Promise<void>((res) => {
    try {
      frames = JSON.parse(__ATLAS_FRAMES__);
    } catch (e) {
      frames = {};
    }
    const im = new Image();
    im.onload = () => {
      atlasImg = im;
      res();
    };
    // Atlas açılmazsa oyunu kilitleme: prosedürel çizime düşülüyor.
    im.onerror = () => res();
    im.src = 'data:image/webp;base64,' + __ATLAS_B64__;
  });
}

/** #rrggbb + alpha -> rgba(); prosedürel gradient'lerde sık lazım oluyor. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
const cache: Record<string, HTMLCanvasElement> = {};

export function sprite(level: number, size: number): HTMLCanvasElement {
  const px = Math.max(24, Math.round(size));
  const lv = Math.min(Math.max(level, 1), LEVELS.length);
  const key = lv + ':' + px;
  const hit = cache[key];
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = px;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const s = LEVELS[lv - 1];

  if (__ART__ === 'atlas' && atlasImg) {
    const f = frames[LEVEL_FRAMES[lv - 1]];
    if (f) {
      // Kırpılmış kare orijinal kadrajındaki yerine geri konuyor
      const k = px / f.ow;
      g.drawImage(atlasImg, f.x, f.y, f.w, f.h, f.ox * k, f.oy * k, f.w * k, f.h * k);
      cache[key] = cv;
      return cv;
    }
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Seviye yükseldikçe artan dış hâle — ilerleme rengin yoğunluğuyla da okunuyor
  if (lv >= 3) {
    const aura = g.createRadialGradient(px / 2, px * 0.52, px * 0.18, px / 2, px * 0.52, px * 0.52);
    aura.addColorStop(0, hexA(s.glow, 0.06 + lv * 0.05));
    aura.addColorStop(1, hexA(s.glow, 0));
    g.fillStyle = aura;
    g.fillRect(0, 0, px, px);
  }

  // Zemin gölgesi — nesneyi hücreye oturtuyor, "yüzen sprite" hissini kırıyor
  g.save();
  g.translate(px / 2, px * 0.9);
  g.scale(1, 0.24);
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, px * 0.3);
  sh.addColorStop(0, 'rgba(8,4,24,.5)');
  sh.addColorStop(1, 'rgba(8,4,24,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(0, 0, px * 0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();

  if (lv === 1) egg(g, px, s, false);
  else if (lv === 2) egg(g, px, s, true);
  else if (lv === 3) hatchling(g, px, s);
  else if (lv === 4) wyrmling(g, px, s);
  else dragon(g, px, s);

  cache[key] = cv;
  return cv;
}

// ---------------------------------------------------------------- yardımcılar

function lw(px: number, k: number): number {
  return Math.max(1, px * k);
}

/**
 * Hacim veren dolgu. Referans kreatiflerin görsel grameri şu: hiçbir eleman düz
 * değil. Dört katman: düşen gölge, dikey gradient, forma clip'lenmiş üst ışık,
 * ve altta ambient occlusion. Üstüne kalın koyu kontur.
 */
function fillStroke(g: CanvasRenderingContext2D, px: number, c1: string, c2: string, y0: number, y1: number): void {
  const h = y1 - y0;

  const grd = g.createLinearGradient(0, y0, 0, y1);
  grd.addColorStop(0, c1);
  grd.addColorStop(0.55, c2);
  grd.addColorStop(1, c2);
  g.save();
  g.shadowColor = 'rgba(12,6,32,.5)';
  g.shadowBlur = px * 0.055;
  g.shadowOffsetY = px * 0.022;
  g.fillStyle = grd;
  g.fill();
  g.restore();

  g.save();
  g.clip();
  const hi = g.createRadialGradient(px * 0.37, y0 + h * 0.1, px * 0.01, px * 0.45, y0 + h * 0.22, px * 0.4);
  hi.addColorStop(0, 'rgba(255,255,255,.6)');
  hi.addColorStop(0.6, 'rgba(255,255,255,.12)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, px, px);

  const ao = g.createLinearGradient(0, y1 - h * 0.5, 0, y1);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(24,8,48,.4)');
  g.fillStyle = ao;
  g.fillRect(0, 0, px, px);
  g.restore();

  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.034);
  g.stroke();
}

function shine(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  g.save();
  g.fillStyle = 'rgba(255,255,255,.72)';
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, -0.5, 0, Math.PI * 2);
  g.fill();
  // ikinci küçük kıvılcım — cam/parlak hissi tek highlight'la oluşmuyor
  g.globalAlpha = 0.6;
  g.beginPath();
  g.ellipse(cx + rx * 1.5, cy + ry * 1.25, rx * 0.42, ry * 0.36, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function eyes(g: CanvasRenderingContext2D, px: number, cx: number, cy: number, r: number, angry: boolean): void {
  for (const dir of [-1, 1]) {
    const ex = cx + dir * r * 1.15;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ex, cy, r, r * 1.15, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = lw(px, 0.016);
    g.stroke();
    g.fillStyle = '#181330';
    g.beginPath();
    g.ellipse(ex + dir * r * 0.18, cy + r * 0.12, r * 0.48, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ex + dir * r * 0.02, cy - r * 0.3, r * 0.2, 0, Math.PI * 2);
    g.fill();
    if (angry) {
      g.strokeStyle = OUTLINE;
      g.lineWidth = lw(px, 0.028);
      g.beginPath();
      g.moveTo(ex - dir * r * 1.05, cy - r * 1.5);
      g.lineTo(ex + dir * r * 0.9, cy - r * 0.95);
      g.stroke();
    }
  }
}

function wing(g: CanvasRenderingContext2D, px: number, cx: number, cy: number, r: number, dir: number, dark: string, spread: number): void {
  g.beginPath();
  g.moveTo(cx + dir * r * 0.55, cy);
  g.quadraticCurveTo(cx + dir * r * spread * 1.5, cy - r * spread * 1.35, cx + dir * r * spread * 1.42, cy + r * 0.05);
  g.quadraticCurveTo(cx + dir * r * spread * 1.05, cy + r * 0.02, cx + dir * r * spread * 1.12, cy + r * 0.52);
  g.quadraticCurveTo(cx + dir * r * spread * 0.72, cy + r * 0.3, cx + dir * r * 0.55, cy + r * 0.55);
  g.closePath();
  g.fillStyle = dark;
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.026);
  g.stroke();
}

/**
 * Kalın koni boynuz. İlk versiyon ince bir sliver çiziyordu ve ekranda
 * anten gibi okunuyordu — tabanı geniş, ucu kıvrık olacak şekilde yeniden yazıldı.
 */
function horn(g: CanvasRenderingContext2D, px: number, x: number, y: number, r: number, dir: number): void {
  g.beginPath();
  g.moveTo(x - dir * r * 0.34, y + r * 0.18);
  g.lineTo(x + dir * r * 0.3, y + r * 0.24);
  g.quadraticCurveTo(x + dir * r * 0.98, y - r * 0.42, x + dir * r * 0.66, y - r * 1.0);
  g.quadraticCurveTo(x + dir * r * 0.2, y - r * 0.36, x - dir * r * 0.34, y + r * 0.18);
  g.closePath();
  g.fillStyle = '#fbe6c0';
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.024);
  g.stroke();
}

/**
 * Kuyruk: kapalı bezier yerine kalınlığı azalan çift stroke + uçta mızrak.
 * Elle bezier ayarlamak hata veriyordu (gövdeden kopuk bir leke çıkıyordu);
 * stroke tabanlı çizim hem kontrol edilebilir hem konturu bedava geliyor.
 */
function tail(g: CanvasRenderingContext2D, px: number, cx: number, cy: number, r: number, dark: string, dir: number): void {
  const x0 = cx + dir * r * 0.1;
  const y0 = cy + r * 0.62;
  const cxp = cx + dir * r * 1.35;
  const cyp = cy + r * 1.1;
  const x1 = cx + dir * r * 1.42;
  const y1 = cy + r * 0.22;

  g.lineCap = 'round';
  g.strokeStyle = OUTLINE;
  g.lineWidth = r * 0.38;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(cxp, cyp, x1, y1);
  g.stroke();
  g.strokeStyle = dark;
  g.lineWidth = r * 0.26;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(cxp, cyp, x1, y1);
  g.stroke();

  // uç mızrağı
  g.beginPath();
  g.moveTo(x1 - dir * r * 0.3, y1 + r * 0.12);
  g.lineTo(x1 + dir * r * 0.34, y1 - r * 0.02);
  g.lineTo(x1 - dir * r * 0.1, y1 - r * 0.42);
  g.closePath();
  g.fillStyle = dark;
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.024);
  g.stroke();
}

// ---------------------------------------------------------------- seviyeler

function egg(g: CanvasRenderingContext2D, px: number, s: LevelSkin, cracked: boolean): void {
  const cx = px / 2;
  const cy = px * 0.52;
  const rx = px * 0.31;
  const ry = px * 0.38;

  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  fillStroke(g, px, s.c1, s.c2, cy - ry, cy + ry);

  g.fillStyle = s.dark;
  g.globalAlpha = 0.4;
  for (const [dx, dy, r] of [[-0.4, 0.2, 0.16], [0.32, -0.02, 0.13], [0.02, 0.5, 0.14], [-0.1, -0.38, 0.1]] as Array<[number, number, number]>) {
    g.beginPath();
    g.ellipse(cx + dx * rx, cy + dy * ry, r * rx, r * rx * 0.85, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  if (cracked) {
    g.strokeStyle = OUTLINE;
    g.lineWidth = lw(px, 0.03);
    g.beginPath();
    g.moveTo(cx - rx * 0.95, cy - ry * 0.25);
    g.lineTo(cx - rx * 0.42, cy - ry * 0.5);
    g.lineTo(cx - rx * 0.05, cy - ry * 0.18);
    g.lineTo(cx + rx * 0.4, cy - ry * 0.48);
    g.lineTo(cx + rx * 0.95, cy - ry * 0.22);
    g.stroke();
    // kabuktan bakan göz
    g.save();
    g.beginPath();
    g.ellipse(cx, cy + ry * 0.12, rx * 0.95, ry * 0.8, 0, 0, Math.PI * 2);
    g.clip();
    eyes(g, px, cx, cy + ry * 0.1, rx * 0.19, false);
    g.restore();
  }

  shine(g, cx - rx * 0.38, cy - ry * 0.45, rx * 0.19, ry * 0.26);
}

function hatchling(g: CanvasRenderingContext2D, px: number, s: LevelSkin): void {
  const cx = px / 2;
  const cy = px * 0.56;
  const r = px * 0.29;

  // ayaklar
  g.fillStyle = '#f0a63c';
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.022);
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * r * 0.42, cy + r * 0.95, r * 0.26, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // stub kanatlar
  for (const dir of [-1, 1]) wing(g, px, cx, cy + r * 0.05, r * 0.62, dir, s.dark, 0.85);

  // gövde
  g.beginPath();
  g.ellipse(cx, cy, r * 0.9, r, 0, 0, Math.PI * 2);
  fillStroke(g, px, s.c1, s.c2, cy - r, cy + r);

  // göbek
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.28, r * 0.46, r * 0.5, 0, 0, Math.PI * 2);
  g.fill();

  eyes(g, px, cx, cy - r * 0.12, r * 0.2, false);

  // gaga
  g.fillStyle = '#f0a63c';
  g.beginPath();
  g.moveTo(cx - r * 0.13, cy + r * 0.22);
  g.lineTo(cx + r * 0.13, cy + r * 0.22);
  g.lineTo(cx, cy + r * 0.42);
  g.closePath();
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.02);
  g.stroke();

  // kafadaki kabuk parçası
  g.beginPath();
  g.moveTo(cx - r * 0.62, cy - r * 0.78);
  g.lineTo(cx - r * 0.34, cy - r * 1.08);
  g.lineTo(cx - r * 0.06, cy - r * 0.8);
  g.lineTo(cx + r * 0.26, cy - r * 1.12);
  g.lineTo(cx + r * 0.6, cy - r * 0.82);
  g.quadraticCurveTo(cx, cy - r * 1.5, cx - r * 0.62, cy - r * 0.78);
  g.closePath();
  g.fillStyle = '#fff4dd';
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.024);
  g.stroke();

  shine(g, cx - r * 0.42, cy - r * 0.4, r * 0.17, r * 0.24);
}

function mouth(g: CanvasRenderingContext2D, px: number, cx: number, y: number, w: number, fangs: boolean): void {
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.028);
  g.beginPath();
  g.moveTo(cx - w, y);
  g.quadraticCurveTo(cx, y + w * 0.85, cx + w, y);
  g.stroke();
  if (!fangs) return;
  g.fillStyle = '#fff';
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + dir * w * 0.52, y + w * 0.17);
    g.lineTo(cx + dir * w * 0.78, y + w * 0.1);
    g.lineTo(cx + dir * w * 0.6, y + w * 0.5);
    g.closePath();
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = lw(px, 0.016);
    g.stroke();
  }
}

function nostrils(g: CanvasRenderingContext2D, cx: number, y: number, r: number): void {
  g.fillStyle = OUTLINE;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * r * 0.16, y, r * 0.055, r * 0.045, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function wyrmling(g: CanvasRenderingContext2D, px: number, s: LevelSkin): void {
  const cx = px / 2;
  const cy = px * 0.54;
  const r = px * 0.26;

  tail(g, px, cx, cy, r, s.dark, -1);
  for (const dir of [-1, 1]) wing(g, px, cx, cy - r * 0.1, r * 0.92, dir, s.dark, 0.95);

  g.beginPath();
  g.ellipse(cx, cy, r * 0.88, r * 0.98, 0, 0, Math.PI * 2);
  fillStroke(g, px, s.c1, s.c2, cy - r, cy + r);

  g.fillStyle = 'rgba(255,255,255,.38)';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.32, r * 0.44, r * 0.46, 0, 0, Math.PI * 2);
  g.fill();

  horn(g, px, cx - r * 0.36, cy - r * 0.78, r * 0.4, -1);
  horn(g, px, cx + r * 0.36, cy - r * 0.78, r * 0.4, 1);

  eyes(g, px, cx, cy - r * 0.22, r * 0.19, false);
  nostrils(g, cx, cy + r * 0.16, r);
  mouth(g, px, cx, cy + r * 0.34, r * 0.26, false);

  shine(g, cx - r * 0.42, cy - r * 0.48, r * 0.16, r * 0.22);
}

function dragon(g: CanvasRenderingContext2D, px: number, s: LevelSkin): void {
  const cx = px / 2;
  const cy = px * 0.56;
  const r = px * 0.24;

  const aura = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.3);
  aura.addColorStop(0, 'rgba(255,170,60,.5)');
  aura.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = aura;
  g.fillRect(0, 0, px, px);

  tail(g, px, cx, cy + r * 0.15, r * 1.05, s.dark, -1);
  for (const dir of [-1, 1]) wing(g, px, cx, cy - r * 0.2, r * 1.3, dir, s.dark, 1.15);

  // sırt dikenleri — gövdeden ÖNCE ve yukarı taşacak şekilde
  g.fillStyle = '#fbe6c0';
  g.strokeStyle = OUTLINE;
  g.lineWidth = lw(px, 0.022);
  for (let i = 0; i < 3; i++) {
    const y = cy + r * (0.1 + i * 0.36);
    const x = cx + r * (0.72 - i * 0.06);
    g.beginPath();
    g.moveTo(x - r * 0.1, y - r * 0.18);
    g.lineTo(x + r * 0.36, y - r * 0.02);
    g.lineTo(x - r * 0.08, y + r * 0.2);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // gövde
  g.beginPath();
  g.ellipse(cx, cy + r * 0.34, r * 0.72, r * 0.78, 0, 0, Math.PI * 2);
  fillStroke(g, px, s.c1, s.c2, cy - r * 0.4, cy + r * 1.1);

  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.52, r * 0.36, r * 0.42, 0, 0, Math.PI * 2);
  g.fill();

  // kafa — burun ayrı elips olarak çizilince domuz gibi okunuyordu;
  // tek geniş kafa + ağız çizgisi + dişler ejderha olarak okunuyor.
  g.beginPath();
  g.ellipse(cx, cy - r * 0.42, r * 0.82, r * 0.68, 0, 0, Math.PI * 2);
  fillStroke(g, px, s.c1, s.c2, cy - r * 1.1, cy + r * 0.2);

  horn(g, px, cx - r * 0.5, cy - r * 0.92, r * 0.52, -1);
  horn(g, px, cx + r * 0.5, cy - r * 0.92, r * 0.52, 1);

  eyes(g, px, cx, cy - r * 0.6, r * 0.18, true);
  nostrils(g, cx, cy - r * 0.2, r);
  mouth(g, px, cx, cy - r * 0.04, r * 0.34, true);

  shine(g, cx - r * 0.42, cy - r * 0.75, r * 0.15, r * 0.2);
}
