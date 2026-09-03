/**
 * 2D asset optimizasyon hattı — "müşteriden gelen PNG'ler"i playable'a sığdırır.
 *
 *   node build/assets-2d.mjs                 assets-lab/in-2d/*.png işler
 *   node build/assets-2d.mjs --max 1024      atlas kenar üst sınırı
 *
 * Adımlar: trim (şeffaf kenarları at) -> atlas'a paketle -> format yarışı.
 *
 * Playable'a özgü iki kural raporu şekillendiriyor:
 *  1. Ölçü ham dosya değil, BASE64 hâli. Tek dosyaya inline ediliyor, +%33.
 *  2. Kazanan sadece küçük olan değil, DECODER GEREKTİRMEYEN olan.
 *     WebP ve AVIF'i tarayıcı natively açıyor; ek runtime maliyeti yok.
 *
 * Boyutun yanında KALİTE de ölçülüyor (PSNR): "en küçük" tek başına
 * bir öneri değil, gözle bozulmayan en küçük olan öneri.
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.indexOf(k) >= 0 ? +argv[argv.indexOf(k) + 1] : d);
const argS = (k, d) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);

// Her playable'ın kendi asset klasörü var; hat artık tek bir klasöre bağlı değil.
const IN = join(ROOT, 'assets-lab', argS('--in', 'in-2d'));
const OUT = join(ROOT, 'assets-lab', argS('--out', 'out-2d'));
const MAX = arg('--max', 2048);
const PAD = arg('--pad', 2);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const b64len = (n) => Math.ceil(n / 3) * 4;
const pct5 = (n) => ((b64len(n) / (5 * 1024 * 1024)) * 100).toFixed(2) + '%';

/** Klasik büyüyen ikili ağaç paketleyici — az sayıda sprite için fazlasıyla yeterli. */
function pack(blocks) {
  blocks.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  let root = { x: 0, y: 0, w: blocks[0].w, h: blocks[0].h };

  const find = (node, w, h) => {
    if (node.used) return find(node.right, w, h) || find(node.down, w, h);
    if (w <= node.w && h <= node.h) return node;
    return null;
  };
  const split = (node, w, h) => {
    node.used = true;
    node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
    node.right = { x: node.x + w, y: node.y, w: node.w - w, h };
    return node;
  };
  const grow = (w, h) => {
    const canDown = w <= root.w;
    const canRight = h <= root.h;
    const shouldRight = canRight && root.h >= root.w + w;
    const shouldDown = canDown && root.w >= root.h + h;
    if (shouldRight) return growRight(w, h);
    if (shouldDown) return growDown(w, h);
    if (canRight) return growRight(w, h);
    if (canDown) return growDown(w, h);
    return null;
  };
  const growRight = (w, h) => {
    root = { used: true, x: 0, y: 0, w: root.w + w, h: root.h, down: root, right: { x: root.w, y: 0, w, h: root.h } };
    const node = find(root, w, h);
    return node ? split(node, w, h) : null;
  };
  const growDown = (w, h) => {
    root = { used: true, x: 0, y: 0, w: root.w, h: root.h + h, down: { x: 0, y: root.h, w: root.w, h }, right: root };
    const node = find(root, w, h);
    return node ? split(node, w, h) : null;
  };

  for (const b of blocks) {
    const node = find(root, b.w, b.h);
    b.fit = node ? split(node, b.w, b.h) : grow(b.w, b.h);
  }
  return { w: root.w, h: root.h };
}

/**
 * PSNR (dB, yüksek iyi).
 *
 * ALFA AĞIRLIKLI. İlk sürüm ham RGBA'yı doğrudan karşılaştırıyordu ve kayıpsız
 * PNG'ye bile 13.8 dB diyordu: tamamen şeffaf piksellerin RGB'si encoder'a göre
 * değişiyor (kimi sıfırlıyor, kimi koruyor) ve atlasın %23'ü boş olduğu için
 * bu fark hatayı domine ediyordu. Görünmeyen pikselin rengi kalite değildir —
 * RGB hatası alfa ile ağırlıklandırılıyor, alfa kanalı ayrıca ölçülüyor.
 */
async function psnr(origRaw, buf) {
  const test = await sharp(buf).ensureAlpha().raw().toBuffer();
  const n = Math.min(origRaw.length, test.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i += 4) {
    const a = origRaw[i + 3] / 255;
    if (a > 0) {
      for (let c = 0; c < 3; c++) {
        const d = origRaw[i + c] - test[i + c];
        sum += a * d * d;
        count += a;
      }
    }
    const da = origRaw[i + 3] - test[i + 3];
    sum += da * da;
    count += 1;
  }
  const mse = sum / Math.max(1, count);
  if (mse <= 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

if (!existsSync(IN)) {
  console.error('Girdi klasörü yok: ' + IN);
  process.exit(1);
}
const files = readdirSync(IN).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) {
  console.error('assets-lab/in-2d içinde görsel yok.');
  process.exit(1);
}

console.log('\n  ' + '='.repeat(74));
console.log('  2D ASSET HATTI — ' + files.length + ' dosya   (' + IN.slice(ROOT.length + 1) + ')');
console.log('  ' + '='.repeat(74));

// --- 1) trim
let rawTotal = 0;
const blocks = [];
for (const f of files) {
  const p = join(IN, f);
  rawTotal += statSync(p).size;
  const img = sharp(p).ensureAlpha();
  const before = await img.metadata();
  const trimmed = await sharp(p).ensureAlpha().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  blocks.push({
    name: basename(f, extname(f)),
    buf: trimmed.data,
    w: trimmed.info.width + PAD * 2,
    h: trimmed.info.height + PAD * 2,
    iw: trimmed.info.width,
    ih: trimmed.info.height,
    ow: before.width,
    oh: before.height,
    // trim ofseti olmadan sprite orijinal kadrajına geri konamıyor
    ox: trimmed.info.trimOffsetLeft ? -trimmed.info.trimOffsetLeft : 0,
    oy: trimmed.info.trimOffsetTop ? -trimmed.info.trimOffsetTop : 0,
  });
}

console.log('\n  TRIM — şeffaf kenarları atmak bedava kazanç');
console.log('  ' + '-'.repeat(74));
for (const b of blocks) {
  const savedPx = 1 - (b.iw * b.ih) / (b.ow * b.oh);
  console.log('  ' + b.name.padEnd(14) + (b.ow + '×' + b.oh).padStart(10) + '  ->' +
    (b.iw + '×' + b.ih).padStart(10) + '   piksel alanı ' + (savedPx * 100).toFixed(0) + '% azaldı');
}

// --- 2) atlas
const sheet = pack(blocks);
if (sheet.w > MAX || sheet.h > MAX) {
  console.log('\n  UYARI: atlas ' + sheet.w + '×' + sheet.h + ', üst sınır ' + MAX + '. Ölçek düşürmek gerekebilir.');
}
// Referans HAM piksel olarak tutuluyor ve bütün varyantlar aynı ham tampondan
// kodlanıyor. Önce atlası PNG'ye kodlayıp her varyantı ondan üretiyordum;
// araya giren premultiply gidiş-dönüşü kenar piksellerini kaydırıyor ve
// kayıpsız PNG bile 37 dB gösteriyordu.
const atlasRaw = await sharp({
  create: { width: sheet.w, height: sheet.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(blocks.map((b) => ({ input: b.buf, left: b.fit.x + PAD, top: b.fit.y + PAD })))
  .raw()
  .toBuffer();
const RAWOPT = { raw: { width: sheet.w, height: sheet.h, channels: 4 } };
const from = () => sharp(atlasRaw, RAWOPT);

const usedPx = blocks.reduce((a, b) => a + b.iw * b.ih, 0);
console.log('\n  ATLAS ' + sheet.w + '×' + sheet.h + '   doluluk %' +
  ((usedPx / (sheet.w * sheet.h)) * 100).toFixed(0));

const origRaw = atlasRaw;

// --- 3) format yarışı
const variants = [
  // DİKKAT: png()'ye effort/quality/colours vermek sharp'ta paleti otomatik
  // açıyor. İlk sürümde "kayıpsız PNG" satırı aslında kuantize PNG-8'di ve
  // ikisi birebir aynı PSNR veriyordu. Gerçek kayıpsız için sadece compressionLevel.
  ['PNG kayıpsız', () => from().png({ compressionLevel: 9 }).toBuffer(), 'yerleşik'],
  ['PNG-8 (256 renk)', () => from().png({ palette: true, colors: 256, effort: 10 }).toBuffer(), 'yerleşik'],
  ['WebP kayıpsız', () => from().webp({ lossless: true, effort: 6 }).toBuffer(), 'yerleşik'],
  ['WebP q90', () => from().webp({ quality: 90, alphaQuality: 90, effort: 6 }).toBuffer(), 'yerleşik'],
  ['WebP q80', () => from().webp({ quality: 80, alphaQuality: 85, effort: 6 }).toBuffer(), 'yerleşik'],
  ['WebP q70', () => from().webp({ quality: 70, alphaQuality: 80, effort: 6 }).toBuffer(), 'yerleşik'],
  ['AVIF q60', () => from().avif({ quality: 60, effort: 4 }).toBuffer(), 'yerleşik*'],
  ['AVIF q45', () => from().avif({ quality: 45, effort: 4 }).toBuffer(), 'yerleşik*'],
];

console.log('\n  FORMAT YARIŞI — atlas tek dosya olarak');
console.log('  ' + '-'.repeat(74));
console.log('  FORMAT                 boyut     base64    5MB bütçe   PSNR    decoder');
console.log('  ' + '-'.repeat(74));

const results = [];
for (const [label, enc, dec] of variants) {
  try {
    const buf = await enc();
    const q = await psnr(origRaw, buf);
    results.push({ label, bytes: buf.length, q, buf, dec });
    console.log(
      '  ' + label.padEnd(21) +
      kb(buf.length).padStart(10) +
      kb(b64len(buf.length)).padStart(10) +
      pct5(buf.length).padStart(11) +
      (q === Infinity ? '  kayıpsız' : '  ' + q.toFixed(1) + ' dB').padStart(10) +
      '   ' + dec
    );
  } catch (e) {
    console.log('  ' + label.padEnd(21) + '  hata: ' + (e.message || e).slice(0, 40));
  }
}

// --- 4) atlas mı, ayrı dosyalar mı
let sepBytes = 0;
for (const b of blocks) {
  const one = await sharp(b.buf, { raw: undefined }).webp({ quality: 80, alphaQuality: 85, effort: 6 }).toBuffer();
  sepBytes += one.length;
}
const atlasWebp = results.find((r) => r.label === 'WebP q80');
console.log('\n  ATLAS mı AYRI DOSYA mı (hepsi WebP q80)');
console.log('  ' + '-'.repeat(74));
console.log('  ' + String(blocks.length).padStart(2) + ' ayrı dosya : ' + kb(sepBytes).padStart(9) +
  '   base64 ' + kb(b64len(sepBytes)));
console.log('  tek atlas     : ' + kb(atlasWebp.bytes).padStart(9) +
  '   base64 ' + kb(b64len(atlasWebp.bytes)) +
  '   -> ' + (atlasWebp.bytes < sepBytes ? 'atlas ' + kb(sepBytes - atlasWebp.bytes) + ' kazandırıyor' : 'ayrı dosyalar daha küçük'));

// --- 5) öneri. İki kulvar: GÜVENLİ (her webview açar) ve AGRESİF (AVIF).
// Sadece "en küçük" demek yanlış olurdu: AVIF metrikte kazanıyor ama eski
// ad-container webview'larında açılmazsa kreatif boş ekran olur ve o risk
// kazandığı 100 KB'ı hiç karşılamaz.
const OK_DB = 38;
const safe = results.filter((r) => !r.label.startsWith('AVIF'));
const aggressive = results.filter((r) => r.label.startsWith('AVIF'));
const pickFrom = (arr) => {
  const good = arr.filter((r) => r.q >= OK_DB);
  return (good.length ? good : arr).reduce((a, b) => (a.bytes <= b.bytes ? a : b));
};
const best = pickFrom(safe);
const bold = aggressive.length ? pickFrom(aggressive) : null;

mkdirSync(OUT, { recursive: true });
// Kazanan format girdiye göre DEĞİŞİYOR (aynı oyunda tek bir sprite'ı
// değiştirmek PNG-8'i WebP'ye çevirdi). Eski atlas dosyası silinmezse
// build eski uzantıyı bulup bayat görseli gömüyor.
for (const old of ['png', 'webp', 'avif']) rmSync(join(OUT, 'atlas.' + old), { force: true });
const ext = best.label.toLowerCase().includes('webp') ? 'webp' : best.label.toLowerCase().includes('avif') ? 'avif' : 'png';
writeFileSync(join(OUT, 'atlas.' + ext), best.buf);
writeFileSync(
  join(OUT, 'atlas.json'),
  JSON.stringify(
    {
      image: 'atlas.' + ext,
      size: { w: sheet.w, h: sheet.h },
      frames: Object.fromEntries(
        blocks.map((b) => [
          b.name,
          { x: b.fit.x + PAD, y: b.fit.y + PAD, w: b.iw, h: b.ih, ow: b.ow, oh: b.oh, ox: b.ox, oy: b.oy },
        ])
      ),
    },
    null,
    2
  )
);
writeFileSync(join(OUT, 'atlas.b64.txt'), best.buf.toString('base64'));

console.log('\n  ' + '='.repeat(74));
console.log('  ÖNERİ (güvenli): ' + best.label + '  ' + kb(best.bytes) +
  '  -> base64 ' + kb(b64len(best.bytes)) + '  = bütçenin ' + pct5(best.bytes));
if (bold) {
  console.log('  Agresif seçenek: ' + bold.label + '  ' + kb(bold.bytes) +
    '  -> base64 ' + kb(b64len(bold.bytes)) + '   ' + bold.q.toFixed(1) + ' dB, ' +
    (((best.bytes - bold.bytes) / best.bytes) * 100).toFixed(0) + '% daha küçük');
  console.log('    AVIF sadece hedef envanterin webview sürümü doğrulanabiliyorsa seçilir:');
  console.log('    açılmazsa kreatif boş ekran olur, kazandığı ' + kb(best.bytes - bold.bytes) + ' o riski karşılamaz.');
}
console.log('  Kural: PSNR 38 dB üstü "gözle ayırt edilmiyor" kabul edildi, içinden en küçüğü.');
console.log('  Geldiği hâl ' + kb(rawTotal) + ' -> ' + kb(best.bytes) +
  '  (' + (((best.bytes - rawTotal) / rawTotal) * 100).toFixed(1) + '%)');
console.log('  Çıktılar: ' + OUT.slice(ROOT.length + 1).split('\\').join('/') + '/atlas.' + ext + ' + atlas.json + atlas.b64.txt');
console.log('  * AVIF: decode desteği yaygın ama eski webview\'larda riskli; kod çözme de yavaş.');
console.log('  ' + '='.repeat(74) + '\n');
