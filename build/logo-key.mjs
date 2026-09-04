/**
 * Logo anahtarlama — macenta zemini söküp saydam WebP üretir.
 *
 *   node build/logo-key.mjs                 seçilen varyantları işler
 *   node build/logo-key.mjs --crowd 2 --blade 3 --order 2   başka varyant
 *
 * NEDEN ANAHTARLAMA. Flux saydam arka plan üretemiyor; her zaman dolu bir
 * zemin veriyor. Klasik çözüm yeşil perde ama logonun kendisi yeşil
 * olabiliyor (Gate Crashers tam olarak yeşil), o yüzden perde MACENTA:
 * paletin hiçbir yerinde yok.
 *
 * ÖLÇÜT RENK MESAFESİ DEĞİL, "MACENTALIK". Tek bir referans renge uzaklığa
 * bakmak çalışmadı: model düz zemin istense de hafif gradyanlı ve vinyetli
 * bir mor veriyor, yani zeminin kendisi tek renk değil. Macentanın tanımı
 * ise dayanıklı — kırmızı ve mavi yüksek, yeşil düşük:
 *
 *     m = min(R, B) - G
 *
 * Altın harfte B düşük, turkuazda R düşük, beyazda üçü eşit; üçünde de m
 * sıfırın altında ya da yakınında kalıyor. Zeminde 80-120 arası çıkıyor.
 * Aradaki bant yumuşak kenar oluyor.
 *
 * SAÇAK GERİ ÇEKİLİYOR. Kenar pikselleri zeminden mor kapıyor; kısmen
 * saydam yapılan her pikselde R ve B, G'ye doğru çekiliyor. Bu yapılmazsa
 * logonun etrafında mor bir hâle kalıyor ve koyu bir kartın üstünde
 * hemen görünüyor.
 */
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IN = join(ROOT, 'assets-lab', 'logos');
const OUT = join(ROOT, 'showcase', 'logos');

const argv = process.argv.slice(2);
const argS = (k, d) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);

/**
 * Seçilen varyantlar — dörder üretimden birer tane.
 *
 * Seçim ölçütü renk: her logo kendi biriminin İKİ ANA RENGİNİ taşıyor.
 * Gate Crashers yeşil-altın bir çayır, Blade Rush altın-turkuaz bir ada.
 * Logonun oyunla aynı paleti taşıması, kapak ile oyun arasındaki bağı
 * yazı olmadan kuruyor.
 */
const PICK = {
  'gate-crashers': { pick: +argS('--crowd', 1), key: 'magenta' },
  'blade-rush': { pick: +argS('--blade', 1), key: 'magenta' },
  // Order Up YEŞİL perdede üretildi: harfleri pembe ve altın, yani macenta
  // perde logonun yarısını silerdi. Bkz. build/logo-gen.mjs.
  'order-up': { pick: +argS('--order', 4), key: 'green' },
};

/**
 * Perde ölçütleri.
 *
 * Her ikisi de "bu piksel ne kadar perde rengi" sorusuna tek sayıyla cevap
 * veriyor ve logonun kendi renklerinde eksiye düşüyor:
 *
 *   macenta  m = min(R,B) - G   altın -120, turkuaz -90, beyaz 0, zemin 80-120
 *   yeşil    m = G - max(R,B)   pembe -129, altın -48, bordo -58, zemin ~75
 *
 * Eşikler ayrı, çünkü modelin verdiği zeminlerin doygunluğu farklı: macenta
 * zemin 80'in üstünde çıkıyor, yeşil zemin 75 civarında. Yeşilde eşik daha
 * dar, ve bedeli logonun yeşil şekerleri: onlar da siliniyor. Prompt bu
 * yüzden "yeşil öge yok" diyor.
 */
const KEYS = {
  magenta: { m: (r, g, b) => Math.min(r, b) - g, hard: 44, soft: 12 },
  green: { m: (r, g, b) => g - Math.max(r, b), hard: 44, soft: 10 },
};

/**
 * Bu eşiğin üstü zemin, altı logo; arası yumuşak kenar.
 *
 * İlk değerler (62/22) fazla toleranslıydı: modelin zemine koyduğu açık
 * hâle "yeterince macenta" sayılmıyor ve logonun etrafında hayalet bir
 * dikdörtgen kalıyordu — koyu kartın üstünde hemen görülüyor. Eşiği
 * düşürmek güvenli, çünkü logonun kendi renklerinde m ölçütü çok
 * negatif: altın -120, turkuaz -90, lacivert gölge -10, beyaz 0.
 */
const HARD = 44;
const SOFT = 12;
/** Çıkış genişliği. Kapak 500 px, logo onun içine oturuyor. */
const WIDTH = 720;

function keyOut(data, info, K) {
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    let r = data[p];
    let g = data[p + 1];
    let b = data[p + 2];
    const m = K.m(r, g, b);
    let a = 255;
    if (m >= K.hard) a = 0;
    else if (m > K.soft) {
      a = Math.round(255 * (1 - (m - K.soft) / (K.hard - K.soft)));
      // Saçak giderme: kenar pikselindeki perde katkısını geri çek. Macentada
      // kırmızı ve maviyi yeşile, yeşilde yeşili diğer ikisine doğru.
      // Daha sert geri çekme: ilk ayarda çöreğin deliğinde yeşilimsi bir
      // halka kalıyordu — delik saydam olmalı ama kenarındaki pikseller
      // perdeden yeşil kapmıştı ve açık bir kartın üstünde görünüyordu.
      const pull = (m - K.soft) * 1.15;
      if (K === KEYS.green) {
        g = Math.max(Math.max(r, b), g - pull);
      } else {
        r = Math.max(g, r - pull);
        b = Math.max(g, b - pull);
      }
    }
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
    if (a > 12) {
      const x = i % width;
      const y = (i / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('anahtarlamadan sonra hicbir piksel kalmadi');
  return { out, box: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

async function run(name, cfg) {
  const pick = cfg.pick;
  const K = KEYS[cfg.key] || KEYS.magenta;
  const src = join(IN, name + '-' + pick + '.png');
  if (!existsSync(src)) throw new Error('yok: ' + src);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { out, box } = keyOut(data, info, K);
  const dest = join(OUT, name + '.webp');
  const meta = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    // 8 piksel pay: kontur ve gölge kırpılmasın.
    .extract({
      left: Math.max(0, box.left - 8),
      top: Math.max(0, box.top - 8),
      width: Math.min(info.width - Math.max(0, box.left - 8), box.width + 16),
      height: Math.min(info.height - Math.max(0, box.top - 8), box.height + 16),
    })
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 95 })
    .toFile(dest);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(
    '  ' + name.padEnd(14) + ' varyant ' + pick + ' (' + cfg.key + ')' +
    '  ' + meta.width + 'x' + meta.height + '  ' + kb(meta.size)
  );
}

async function main() {
  if (!existsSync(IN) || !readdirSync(IN).length) {
    console.error('  Once uret: node build/logo-gen.mjs');
    process.exit(1);
  }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  console.log('');
  for (const [name, cfg] of Object.entries(PICK)) await run(name, cfg);
  console.log('');
}

main().catch((err) => {
  console.error('\n  HATA: ' + err.message + '\n');
  process.exit(1);
});
