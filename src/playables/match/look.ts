/**
 * Görünüm — TEK TARİF, İKİ RENDERER.
 *
 * Bu birim çifti "aynı oyun, iki çizim yolu" iddiasını taşıyor. O yüzden
 * sahnenin görünümü de tek yerde duruyor: arka plan gradyanı ve tahta
 * tepsisi burada tanımlanıyor, 3D sürüm tepsiyi zemin düzlemine doku
 * olarak yapıştırıyor, 2D sürüm aynı fonksiyonu doğrudan tuvale çiziyor.
 * Aynı pikseller, iki yol.
 *
 * NEDEN KOYU ZEMİN. İlk sürüm neredeyse beyaz bir leylak gradyandı ve
 * ölçtüğümde sorun netti: Food Kit modellerinin kendisi soluk (bej çörek,
 * kahve kek, açık sarı muz). Soluk nesneyi açık zemine koyunca ortada
 * kontrast kalmıyor ve ekran "yıkanmış" görünüyor — kullanıcının tarifi
 * tam olarak buydu. Koyu erik bir zemin aynı modelleri hiçbir şeye
 * dokunmadan öne çıkarıyor: sanat değişmedi, ARKASI değişti.
 *
 * Bu ayrım çiftin iddiası için de önemli. Sanat sabit kalmak zorunda,
 * çünkü karşılaştırmanın tamamı ona dayanıyor; zemin ve ışık ise
 * çizicinin kendi işi.
 */

/**
 * Sahnenin arka planı — iki sürümde de body'ye veriliyor.
 *
 * İki katman: üstte sabit konumlu şeker benekleri, altta üstten aşağı
 * derinleşen bir ahududu gradyanı. Benekler CSS gradyanı olarak duruyor,
 * yani ne bir doku ne bir çizim çağrısı — sıfır maliyetle "boş zemin"
 * hissini kırıyorlar.
 *
 * Gradyanın tepesi KASTEN parlak: tepsi ondan koyu olduğu için tahta
 * ekranın en koyu yeri oluyor ve soluk modeller en yüksek kontrastı
 * tam da üstünde durdukları yerde buluyor.
 */
export const BACKDROP = [
  'radial-gradient(circle at 12% 16%, rgba(255,214,120,.5) 0 5px, transparent 6px)',
  'radial-gradient(circle at 86% 12%, rgba(120,232,255,.45) 0 4px, transparent 5px)',
  'radial-gradient(circle at 24% 88%, rgba(255,140,210,.45) 0 6px, transparent 7px)',
  'radial-gradient(circle at 92% 78%, rgba(180,255,170,.4) 0 4px, transparent 5px)',
  'radial-gradient(circle at 66% 6%, rgba(255,255,255,.35) 0 3px, transparent 4px)',
  'radial-gradient(circle at 6% 54%, rgba(255,255,255,.28) 0 3px, transparent 4px)',
  'radial-gradient(circle at 78% 94%, rgba(255,214,120,.35) 0 4px, transparent 5px)',
  'radial-gradient(122% 82% at 50% 24%, #C4459E 0%, #7C2286 38%, #481264 68%, #240838 100%)',
].join(',');

export const LOOK = {
  /** Tepsi gövdesi ve kenarı. Zeminin en koyu yerinden de koyu. */
  tray: '#2A0940',
  trayEdge: 'rgba(255,190,246,.3)',
  /** Hücre yuvaları: dama deseni, ikisi de tepsiden AÇIK. */
  cellA: 'rgba(255,226,252,.1)',
  cellB: 'rgba(255,226,252,.045)',
  /** Seçim halkası. */
  pick: '#FFD65F',
  /** Patlama halkası ve şimşek rengi. */
  spark: '#FFF0B8',
};

/**
 * Tahta tepsisini bir 2D bağlama çizer.
 *
 * `x,y,w,h` tepsinin DIŞ dikdörtgeni, `cell` bir hücrenin kenarı, `cols/rows`
 * ızgara. Üç katman: gövde, içeri gölge, hücre yuvaları. İçeri gölge tek
 * başına tepsiyi "oyulmuş" gösteriyor — düz bir dikdörtgen sahnenin üstüne
 * yapıştırılmış bir kart gibi duruyordu.
 */
export function paintTray(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell: number,
  cols: number,
  rows: number,
  pad: number
): void {
  const r = cell * 0.34;
  g.save();

  g.fillStyle = LOOK.tray;
  rr(g, x, y, w, h, r);
  g.fill();

  // İç gölge: üstten koyu, alta doğru sönüyor.
  const inner = g.createLinearGradient(0, y, 0, y + h);
  inner.addColorStop(0, 'rgba(18,4,28,.5)');
  inner.addColorStop(0.22, 'rgba(18,4,28,0)');
  inner.addColorStop(1, 'rgba(18,4,28,.22)');
  g.fillStyle = inner;
  rr(g, x, y, w, h, r);
  g.fill();

  // Üst kenarda ince ışık: tepsiye kalınlık veriyor.
  g.strokeStyle = LOOK.trayEdge;
  g.lineWidth = Math.max(1.5, cell * 0.035);
  rr(g, x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, r);
  g.stroke();

  const bx = x + pad;
  const by = y + pad;
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    g.fillStyle = (col + row) % 2 ? LOOK.cellA : LOOK.cellB;
    rr(g, bx + col * cell + cell * 0.05, by + row * cell + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.2);
    g.fill();
  }
  g.restore();
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** Yumuşak yuvarlak leke — taşların altındaki temas gölgesi. */
export function blobCanvas(size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const c = size / 2;
  const grd = g.createRadialGradient(c, c, 1, c, c, c - 1);
  grd.addColorStop(0, 'rgba(12,2,20,.55)');
  grd.addColorStop(0.55, 'rgba(12,2,20,.26)');
  grd.addColorStop(1, 'rgba(12,2,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return cv;
}

/**
 * Zincir derinliğine göre kutlama sözü.
 *
 * Zincir bilgisi zaten durumda vardı ama ekranda hiçbir karşılığı yoktu:
 * üç taş da patlasa dokuz taş da patlasa aynı görünüyordu. Oysa cascade
 * match-3'ün en ödüllendirici anı ve reklamda gösterilmesi gereken tam
 * olarak o. Birinci temizlikte söz yok — her hamlede bağıran bir oyun
 * kısa sürede gürültü oluyor.
 */
export function chainWord(chain: number): string | null {
  if (chain < 2) return null;
  if (chain === 2) return 'SWEET!';
  if (chain === 3) return 'TASTY!';
  if (chain === 4) return 'DELICIOUS!';
  return 'INCREDIBLE!';
}
