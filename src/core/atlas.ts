/**
 * Genel amaçlı sprite atlası — build'in gömdüğü `__ATLAS_B64__` /
 * `__ATLAS_FRAMES__` çiftini okur.
 *
 * Bu dosya `defense-2d/atlas.ts` içinden çıkarıldı: `match` birimleri de aynı
 * şeye ihtiyaç duyunca kopyalamak yerine ortak yere alındı. Oyuna özel olan
 * kısım (rakam sprite'larıyla sayı yazma) geride kaldı — paylaşılan dosya
 * yalnızca gerçekten paylaşılanı taşımalı.
 *
 * Üç şey dikkat istedi:
 *
 * 1. FORMAT SABİT DEĞİL. Hat kazananı ölçerek seçiyor ve bu sanat tarzına
 *    göre değişiyor: bizim gradyanlı sprite'larımızda WebP q80 kazanmıştı,
 *    Kenney'nin düz paletli vektör sanatında PNG-8 (27.0 KB, 50.5 dB).
 *    O yüzden mime tipi varsayılmıyor, base64'ün ilk baytlarından okunuyor.
 *
 * 2. TRIM OFSETİ. Hat şeffaf kenarları kesiyor (bu sette piksel alanının
 *    ortalama %60'ı); sprite'ı orijinal kadrajına geri koymak için ox/oy
 *    olmadan her şey kayıyor.
 *
 * 3. ATLAS YÜKLENMEZSE oyun başlamamalı ama KİLİTLENMEMELİ de — hata
 *    durumunda yine de devam ediliyor, çizim boş kalıyor ama CTA yaşıyor.
 */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  ow: number;
  oh: number;
  ox: number;
  oy: number;
}

let img: HTMLImageElement | null = null;
let frames: Record<string, Frame> = {};
const patterns: Record<string, CanvasPattern | null> = {};

/** base64'ün ilk baytları formatı söylüyor; uzantı bilgisi bundle'a gelmiyor. */
function mimeOf(b64: string): string {
  if (b64.indexOf('iVBORw0KGgo') === 0) return 'image/png';
  if (b64.indexOf('UklGR') === 0) return 'image/webp';
  if (b64.indexOf('AAAA') === 0) return 'image/avif';
  return 'image/png';
}

export function loadAtlas(): Promise<void> {
  return new Promise<void>((res) => {
    try {
      frames = JSON.parse(__ATLAS_FRAMES__);
    } catch (e) {
      frames = {};
    }
    if (!__ATLAS_B64__) return res();
    const im = new Image();
    im.onload = () => {
      img = im;
      res();
    };
    im.onerror = () => res();
    im.src = 'data:' + mimeOf(__ATLAS_B64__) + ';base64,' + __ATLAS_B64__;
  });
}

export function ready(): boolean {
  return !!img;
}

/** Kare bilgisi — sprite'ın gerçek genişlik oranına ihtiyaç duyanlar için. */
export function frameOf(name: string): Frame | null {
  return frames[name] || null;
}

/**
 * Sprite'ı (cx, cy) merkezli, orijinal karesi `size` piksel olacak şekilde çizer.
 * `rot` verilirse merkez etrafında döner — kule namlusu ve yürüyen düşman.
 */
export function draw(
  g: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  size: number,
  rot?: number
): void {
  const f = frames[name];
  if (!img || !f) return;
  const k = size / f.ow;
  const x = -size / 2 + f.ox * k;
  const y = -size / 2 + f.oy * k;
  if (rot) {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w * k, f.h * k);
    g.restore();
    return;
  }
  g.drawImage(img, f.x, f.y, f.w, f.h, cx + x, cy + y, f.w * k, f.h * k);
}

/**
 * Karo deseni — zemin için. Her karede 60 ayrı drawImage yerine tek fillRect.
 * Desen ölçekli olmalı, o yüzden ölçek başına bir kez üretilip saklanıyor.
 */
export function pattern(g: CanvasRenderingContext2D, name: string, size: number): CanvasPattern | null {
  const key = name + '@' + Math.round(size);
  if (key in patterns) return patterns[key];
  const f = frames[name];
  if (!img || !f) {
    patterns[key] = null;
    return null;
  }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(size));
  c.height = Math.max(1, Math.round(size));
  const cg = c.getContext('2d') as CanvasRenderingContext2D;
  const k = size / f.ow;
  cg.drawImage(img, f.x, f.y, f.w, f.h, f.ox * k, f.oy * k, f.w * k, f.h * k);
  patterns[key] = g.createPattern(c, 'repeat');
  return patterns[key];
}
