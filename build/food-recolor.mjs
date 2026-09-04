/**
 * Food Kit renk düzeltmesi — palet kartelasını ve bir UV sütununu düzenler.
 *
 *   node build/food-recolor.mjs
 *
 * NEDEN GEREKLİ. Kenney Food Kit modelleri renksiz geliyor; hepsi 512px'lik
 * tek bir RENK KARTELASINA bakıyor ve her yüzeyin UV'si kartelanın içindeki
 * bir kareyi gösteriyor. Yani "kekin üstü çok koyu" demek, modelde değil
 * kartelada bir kareyi değiştirmek demek.
 *
 * ÇAKIŞMA. Kareler paylaşılıyor: donut ile burger ekmeği AYNI sütuna
 * (5 numara) bakıyor. Donut'u pembe yapmak burger ekmeğini de pembe
 * yapardı. Çözüm sütunu boşaltmak — burger'ın o üçgenleri komşu sütuna
 * (4 numara, açık ten) kaydırılıyor, ki zaten ekmek rengi orası; sütun 5
 * böylece donut'a kalıyor ve pembe sırla boyanıyor.
 *
 * NEREYE YAZIYOR. Hem `palette.webp` hem `food.glb`. İkisi de 3D birimin
 * girdisi VE 2D sprite'larının kaynağı, yani düzeltme iki sürüme birden
 * gidiyor — çiftin sanatı aynı kalmak zorunda.
 *
 * Bu bir kerelik bir SANAT adımı, her derlemede çalışmıyor. Çalıştırdıktan
 * sonra sprite'lar yeniden render edilmeli (build/render-sprites.mjs).
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, 'assets-lab', 'out-3d-food');
const PAL = join(DIR, 'palette.webp');
const GLB = join(DIR, 'food.glb');

/** Karteladaki sütun sayısı; kare genişliği = doku / 16. */
const COLS = 16;

/**
 * Değişecek sütunlar.
 *
 * `col` kartela sütunu, `v0..v1` o sütunun boyanacak dikey aralığı,
 * `from`/`to` gradyanın uçları. Kartela her sütunda yukarıdan aşağı hafif
 * bir gradyan taşıyor; onu koruyoruz ki modellerin üstünde hâlâ ton olsun.
 */
const REPAINT = [
  // KEKİN KREMASI. Sütun 1'in bu aralığı kekin kubbesini boyuyor ve
  // ekranda koyu bir leke gibi duruyordu.
  //
  // Önce naneye çevirdim ve DAHA KÖTÜ oldu: kek yeşil kubbe + kırmızı
  // kiraz, kiraz taşı da kırmızı meyve + yeşil yaprak — ikisi bir bakışta
  // ayırt edilemez hâle geldi. Match-3'te asıl suç bu. Açık karamel hem
  // istenen aydınlanmayı veriyor hem de kendi ailesinde kalıyor: pembe
  // çörek, sarı muz, kırmızı kiraz, ten burger, karamel kek.
  { col: 1, v0: 0.5, v1: 0.78, from: '#FFD7A6', to: '#E5A96E' },
  // Burger'ın koyu kısımları. Bunlar da neredeyse siyahtı; sıcak
  // çikolataya çekiliyor.
  { col: 2, v0: 0.5, v1: 0.78, from: '#C9814F', to: '#A9663B' },
  { col: 3, v0: 0.5, v1: 0.78, from: '#B87446', to: '#985B34' },
  // Donut'a ayrılan sütun: çilekli pembe sır.
  { col: 5, v0: 0.5, v1: 0.78, from: '#FF9BD2', to: '#E4569F' },
];

/** Burger'ın 5 numaralı sütunu bırakıp taşınacağı sütun. */
const BURGER_FROM = 5;
const BURGER_TO = 4;

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function repaintPalette() {
  // Dosyayı YOLUYLA değil BELLEKTEN okuyoruz: sharp yolu verildiğinde
  // dosyayı açık tutuyor ve aynı dosyaya geri yazmak Windows'ta kilitleniyor.
  const { data, info } = await sharp(readFileSync(PAL))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const cw = w / COLS;
  for (const r of REPAINT) {
    const a = hex(r.from);
    const b = hex(r.to);
    const x0 = Math.round(r.col * cw);
    const x1 = Math.round((r.col + 1) * cw);
    const y0 = Math.round(r.v0 * h);
    const y1 = Math.round(r.v1 * h);
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) / Math.max(1, y1 - y0 - 1);
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * info.channels;
        data[i] = Math.round(a[0] + (b[0] - a[0]) * k);
        data[i + 1] = Math.round(a[1] + (b[1] - a[1]) * k);
        data[i + 2] = Math.round(a[2] + (b[2] - a[2]) * k);
      }
    }
  }
  // Aynı dosyaya doğrudan yazmak sharp'ta kilitleniyor; önce belleğe.
  const buf = await sharp(data, { raw: { width: w, height: h, channels: info.channels } })
    .webp({ quality: 92 })
    .toBuffer();
  writeFileSync(PAL, buf);
  console.log('  palet güncellendi: ' + REPAINT.length + ' sütun');
}

/** Burger'ın UV'lerini 5. sütundan 4. sütuna kaydır. */
async function moveBurgerColumn() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(GLB);
  const shift = (BURGER_TO - BURGER_FROM) / COLS;
  let moved = 0;
  for (const node of doc.getRoot().listNodes()) {
    if (node.getParentNode()) continue;
    if (node.getName().replace(/_\d+$/, '') !== 'burger') continue;
    const walk = (n) => {
      const mesh = n.getMesh();
      if (mesh) {
        for (const prim of mesh.listPrimitives()) {
          const uv = prim.getAttribute('TEXCOORD_0');
          if (!uv) continue;
          const el = [];
          for (let i = 0; i < uv.getCount(); i++) {
            uv.getElement(i, el);
            const col = Math.floor(el[0] * COLS);
            if (col !== BURGER_FROM) continue;
            el[0] += shift;
            uv.setElement(i, el);
            moved++;
          }
        }
      }
      for (const ch of n.listChildren()) walk(ch);
    };
    walk(node);
  }
  await io.write(GLB, doc);
  console.log('  burger UV: ' + moved + ' köşe ' + BURGER_FROM + ' -> ' + BURGER_TO + ' sütununa');
}

/**
 * Sprite render'i icin DOKUSU GOMULU bir kopya uretir.
 *
 * Hat, dokuyu GLB'den sokup yaninda tasiyor (sebebi core/palette.ts'te) ve
 * calisma aninda bagliyor. Sprite render sayfasi ise GLB'yi oldugu gibi
 * yukluyor, yani sokuleni bilmiyor - dokusuz modelleri bembeyaz render
 * ederdi. Bu kopya sadece o adim icin: palet geri gomulu, oyuna girmiyor.
 */
async function writeTexturedCopy() {
  const io2 = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io2.read(GLB);
  const tex = doc
    .createTexture('palette')
    .setImage(readFileSync(PAL))
    .setMimeType('image/webp');
  let n = 0;
  for (const mat of doc.getRoot().listMaterials()) {
    if (mat.getName().indexOf('palette') !== 0) continue;
    mat.setBaseColorTexture(tex);
    n++;
  }
  const dest = join(DIR, 'food-textured.glb');
  await io2.write(dest, doc);
  console.log('  sprite kaynagi: food-textured.glb  (' + n + ' malzemeye palet gomuldu)');
}

if (!existsSync(PAL) || !existsSync(GLB)) {
  console.error('  Once `npm run assets:food` calistir.');
  process.exit(1);
}
console.log('');
await moveBurgerColumn();
await repaintPalette();
await writeTexturedCopy();
console.log('');
console.log('  Simdi spriteları yenile:');
console.log('    node build/render-sprites.mjs --glb out-3d-food/food-textured.glb --out in-2d-food');
console.log('');
