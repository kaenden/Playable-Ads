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
  'radial-gradient(circle at 12% 16%, rgba(255,224,130,.85) 0 5px, transparent 6px)',
  'radial-gradient(circle at 86% 12%, rgba(120,240,255,.8) 0 4px, transparent 5px)',
  'radial-gradient(circle at 24% 88%, rgba(255,150,220,.8) 0 6px, transparent 7px)',
  'radial-gradient(circle at 92% 78%, rgba(170,255,150,.75) 0 4px, transparent 5px)',
  'radial-gradient(circle at 66% 6%, rgba(255,255,255,.6) 0 3px, transparent 4px)',
  'radial-gradient(circle at 6% 54%, rgba(255,255,255,.5) 0 3px, transparent 4px)',
  'radial-gradient(circle at 78% 94%, rgba(255,224,130,.6) 0 4px, transparent 5px)',
  'radial-gradient(circle at 40% 70%, rgba(120,240,255,.5) 0 3px, transparent 4px)',
  // GRADYAN İKİ UÇTA DA PEMBE. Tek yönlü geçişte ekranın alt yarısı koyu
  // bir bloğa dönüşüyordu ve CTA'nın oturduğu şerit ölü kalıyordu. Aynı
  // pembe aşağıda da belirince kare bir bütün oluyor, tahta da ortada
  // en koyu yer olarak kalmaya devam ediyor.
  'radial-gradient(120% 55% at 50% 112%, #E24FB4 0%, #8A2394 34%, rgba(62,16,112,0) 72%)',
  'radial-gradient(126% 86% at 50% 16%, #FF5FC4 0%, #C42FA8 26%, #7A1E9E 54%, #3E1070 82%, #2A0846 100%)',
].join(',');

export const LOOK = {
  /**
   * Tepsi gövdesi ve kenarı.
   *
   * Koyu ama SİYAH DEĞİL: doygun bir menekşe. Neredeyse siyah bir tepsi
   * kontrastı veriyordu ama ekranı ağırlaştırıyordu; match oyunlarının
   * görüntüsü parlak ve doygun.
   *
   * Ölçüyle ayarlandı: tepsi ekranın en büyük yüzeyi, o yüzden karenin
   * ortalama parlaklığını tek başına o belirliyor. #3A0F63 ile kare %30
   * parlaklıkta kalıyordu — kontrast iyi, ama tür için karanlık. #511A85
   * kareyi yükseltirken taşları hâlâ öne çıkarıyor, çünkü taşların değeri
   * ondan yüksek.
   */
  tray: '#511A85',
  trayEdge: 'rgba(255,206,255,.5)',
  /** Hücre yuvaları: dama deseni, ikisi de tepsiden AÇIK. */
  cellA: 'rgba(255,236,255,.19)',
  cellB: 'rgba(255,236,255,.09)',
  /** Seçim halkası. */
  pick: '#FFE45F',
  /** Patlama halkası ve şimşek rengi. */
  spark: '#FFF6C4',
  /** Roket ışını ve bomba halkası. */
  beam: '#FFF6D0',
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
 * PARLAMA HALESİ — her taşın arkasında kendi renginde bir ışık.
 *
 * İki iş birden yapıyor. Birincisi taşları ışıldatıyor: gerçek bir bloom
 * post-process bu bütçede pahalı ve gereksiz, hâlbuki arkaya konan yumuşak
 * bir ışık aynı izlenimi bedavaya veriyor. İkincisi ve daha önemlisi RENK:
 * Kenney'nin yemek modelleri soluk ve birbirine yakın tonlarda, ama her
 * türün kendi halesi olunca tahta beş ayrı renge ayrılıyor — çörek altın,
 * kek pembe, kiraz kırmızı. Oyuncu türü modelden önce RENKTEN tanıyor.
 *
 * Doku beyaz üretiliyor, rengi çağıran veriyor: 3D'de örnek rengi
 * (`setColorAt`), 2D'de önceden boyanmış kopya. Tek gradyan, iki yol.
 */
export function glowCanvas(size: number, color?: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const c = size / 2;
  const grd = g.createRadialGradient(c, c, 1, c, c, c - 1);
  const col = color || '#ffffff';
  // MERKEZ KASTEN ZAYIF. İlk denemede hale ortada en güçlüydü ve toplamalı
  // karıştığı için taşın kendi formunu yakıyordu — muzlar beyaz bir leke
  // oluyordu. Işık halkası taşın ARKASINDAN taşmalı, üstünden değil: en
  // parlak yer modelin kenarının hemen dışı.
  grd.addColorStop(0, alpha(col, 0.24));
  grd.addColorStop(0.34, alpha(col, 0.42));
  grd.addColorStop(0.62, alpha(col, 0.2));
  grd.addColorStop(1, alpha(col, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return cv;
}

function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/**
 * PIRILTI — taşların üstünde beliren dört uçlu yıldız.
 *
 * Tahta hareketsizken bile canlı kalsın diye. Konumu ve zamanı taşın
 * indeksinden türetiliyor, yani rastgele değil ama düzenli de görünmüyor;
 * her taş kendi ritminde parlıyor.
 */
export function sparkle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  k: number
): void {
  if (k <= 0) return;
  const s = r * k;
  g.save();
  g.globalAlpha = k;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx, cy - s);
  g.quadraticCurveTo(cx + s * 0.16, cy - s * 0.16, cx + s, cy);
  g.quadraticCurveTo(cx + s * 0.16, cy + s * 0.16, cx, cy + s);
  g.quadraticCurveTo(cx - s * 0.16, cy + s * 0.16, cx - s, cy);
  g.quadraticCurveTo(cx - s * 0.16, cy - s * 0.16, cx, cy - s);
  g.fill();
  g.restore();
}

/**
 * Tahtanın üstünden geçen ışık şeridi.
 *
 * Kart oyunlarındaki folyo parlaması. Birkaç saniyede bir soldan sağa
 * kayıyor ve tahtayı bir an için ışıtıyor — hiçbir bilgi taşımıyor, işi
 * sadece ekranın canlı olduğunu söylemek. `lighter` ile bindiriliyor,
 * yani karartmıyor sadece ekliyor.
 */
export function glossSweep(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number
): void {
  // Daha SEYREK ve daha ince. İlk ayarda dört buçuk saniyede bir geçiyordu
  // ve pırıltılarla birlikte ekranda sürekli bir şeyler parlıyordu;
  // kullanıcının "ışık patlamaları çok fazla" dediği yer burasıydı.
  const period = 7.5;
  const p = (t % period) / period;
  if (p > 0.22) return;
  const k = p / 0.22;
  const cx = x - w * 0.4 + k * w * 1.8;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.globalCompositeOperation = 'lighter';
  const grd = g.createLinearGradient(cx - w * 0.22, y, cx + w * 0.22, y + h);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.5, 'rgba(255,236,255,.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
  g.restore();
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
