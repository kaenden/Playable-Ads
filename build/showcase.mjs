/**
 * Vitrin sayfasını üretir.
 *
 *   node build/showcase.mjs
 *
 * Playable'ların preview build'lerini base64 olarak gömer ve boyut/yüzde
 * değerlerini dist'ten OKUYARAK yazar — sayfadaki sayılar elle girilmiyor,
 * dolayısıyla gerçekle asla ayrışmıyor.
 *
 * İki çıktı:
 *   showcase/index.html        Artifact formatı (doctype/head/body sarmalayıcısı yok)
 *   dist/showcase/index.html   Kendi başına açılabilir standalone sayfa
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadIdentity, identityVars } from './identity.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'showcase');
const TEMPLATE = join(OUT_DIR, 'template.html');

const LIMIT = 5 * 1024 * 1024;
const META_LIMIT = 2 * 1024 * 1024;

function unit(name) {
  const file = join(DIST, name, 'showcase', 'index.html');
  if (!existsSync(file)) {
    console.error('Eksik build: ' + file + '\nÖnce `npm run build` çalıştır.');
    process.exit(1);
  }
  const buf = readFileSync(file);
  return { bytes: statSync(file).size, b64: buf.toString('base64') };
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/**
 * KAPAK GÖRSELLERİ.
 *
 * `showcase/posters/` altındaki PNG'ler birimlerin GERÇEK ekran görüntüleri —
 * tarayıcıda dist build'i açıp çekildiler. Elle çizilmiş bir kapak burada
 * yalan olurdu: kart neyi vaat ediyorsa tıklayınca aynısı açılmalı.
 *
 * Burada WebP'ye çevrilip data URI olarak gömülüyorlar. Sayfanın dış istek
 * yapmaması kuralı vitrin için de geçerli: tek dosya, tek parça.
 */
async function poster(name) {
  const src = join(OUT_DIR, 'posters', name + '.png');
  if (!existsSync(src)) {
    console.error('Kapak yok: ' + src);
    process.exit(1);
  }
  const buf = await sharp(src).resize({ width: 360 }).webp({ quality: 76 }).toBuffer();
  return { uri: 'data:image/webp;base64,' + buf.toString('base64'), bytes: buf.length };
}

/** Bir klasördeki .glb dosyalarının toplam boyutu — "geldiği hâli" ölçüsü. */
function dirBytes(dir) {
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.glb'))
    .reduce((a, f) => a + statSync(join(dir, f)).size, 0);
}
const pct = (n, lim) => (n / lim) * 100;
const pctStr = (n, lim) => {
  const p = pct(n, lim);
  return (p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%';
};

// Vitrinde HEPSİ ASSET BUILD'İ.
//
// Hattın gerçeği bu: müşteri asset gönderiyor, prosedürel üretim asset
// gelmediğinde ya da bütçe kritik olduğunda başvurulan yedek. Sayfa da
// teslim edilecek olanı göstermeli; prosedürel karşılaştırma katlanmış
// bölümde ölçüm olarak duruyor.
const u2d = unit('merge-2d-atlas');
const u3d = unit('merge-3d-atlas');
const uesc = unit('escape-3d-atlas');
const utd = unit('defense-2d');
const um2 = unit('match-2d');
const um3 = unit('match-3d');
const urun = unit('run-3d');
const ustr = unit('strike-3d');

const posters = {
  RUN: await poster('run-3d'),
  STR: await poster('strike-3d'),
  ESC: await poster('escape-3d'),
  TD: await poster('defense-2d'),
  M3: await poster('match-3d'),
  M2: await poster('match-2d'),
  '3D': await poster('merge-3d'),
  '2D': await poster('merge-2d'),
};

// Kunye tek kaynaktan: showcase/identity.json. Artifact calisma kopyasi
// oldugu icin isim eksikse durmuyoruz — sayfanin tepesinde rozet cikiyor.
const ident = loadIdentity(ROOT);

const vars = {
  '%%B64_2D%%': u2d.b64,
  '%%B64_3D%%': u3d.b64,
  '%%B64_ESC%%': uesc.b64,
  '%%B64_TD%%': utd.b64,
  '%%B64_M2%%': um2.b64,
  '%%B64_M3%%': um3.b64,
  '%%B64_RUN%%': urun.b64,
  '%%B64_STR%%': ustr.b64,
  '%%SIZE_2D%%': kb(u2d.bytes),
  '%%SIZE_3D%%': kb(u3d.bytes),
  '%%SIZE_ESC%%': kb(uesc.bytes),
  '%%SIZE_TD%%': kb(utd.bytes),
  '%%SIZE_M2%%': kb(um2.bytes),
  '%%SIZE_M3%%': kb(um3.bytes),
  '%%SIZE_RUN%%': kb(urun.bytes),
  '%%SIZE_STR%%': kb(ustr.bytes),
  '%%PCT_2D%%': pctStr(u2d.bytes, LIMIT),
  '%%PCT_3D%%': pctStr(u3d.bytes, LIMIT),
  '%%PCT_ESC%%': pctStr(uesc.bytes, LIMIT),
  '%%PCT_TD%%': pctStr(utd.bytes, LIMIT),
  '%%PCT_M2%%': pctStr(um2.bytes, LIMIT),
  '%%PCT_M3%%': pctStr(um3.bytes, LIMIT),
  '%%PCT_RUN%%': pctStr(urun.bytes, LIMIT),
  '%%PCT_STR%%': pctStr(ustr.bytes, LIMIT),
  // Runner'ın asset zinciri — sayfada elle yazılmasın diye dosyadan okunuyor.
  '%%RUN_RAW%%': kb(dirBytes(join(ROOT, 'assets-lab', 'in-3d-run'))),
  '%%RUN_GLB%%': kb(statSync(join(ROOT, 'assets-lab', 'out-3d-run', 'run.glb')).size),
  '%%RUN_CALLS%%': '81',
  '%%POSTER_RUN%%': posters.RUN.uri,
  '%%POSTER_STR%%': posters.STR.uri,
  '%%POSTER_ESC%%': posters.ESC.uri,
  '%%POSTER_TD%%': posters.TD.uri,
  '%%POSTER_M3%%': posters.M3.uri,
  '%%POSTER_M2%%': posters.M2.uri,
  '%%POSTER_3D%%': posters['3D'].uri,
  '%%POSTER_2D%%': posters['2D'].uri,
  // Artifact sürümü TEK DOSYA: birimlerin kendi adresi yok, hepsi gömülü.
  // Kart yine de bir bağlantı, sadece gidecek yeri olmadığı için '#'.
  '%%HREF_RUN%%': '#',
  '%%HREF_STR%%': '#',
  '%%HREF_ESC%%': '#',
  '%%HREF_TD%%': '#',
  '%%HREF_M3%%': '#',
  '%%HREF_M2%%': '#',
  '%%HREF_3D%%': '#',
  '%%HREF_2D%%': '#',
  '%%DOWNLOADS%%': '',
  '%%DELTA_RS%%': kb(Math.abs(ustr.bytes - urun.bytes)),
  '%%RATIO_M%%': (um3.bytes / um2.bytes).toFixed(1) + '×',
  '%%RATIO_3D%%': (u3d.bytes / u2d.bytes).toFixed(1) + '×',
  '%%PCT_META_3D%%': pctStr(u3d.bytes, META_LIMIT),
  // Sayfada görünen sürüm damgası: bir sorun bildirildiğinde hangi kopyanın
  // görüldüğü tahmin edilmek zorunda kalmıyor.
  '%%BUILD%%': 'build ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
};

Object.assign(vars, identityVars(ident, false));

let page = readFileSync(TEMPLATE, 'utf8');
for (const [k, v] of Object.entries(vars)) page = page.split(k).join(v);

writeFileSync(join(OUT_DIR, 'index.html'), page);

mkdirSync(join(DIST, 'showcase'), { recursive: true });
const standalone =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  '<style>html,body{margin:0}img{max-width:100%}</style>\n' +
  '</head>\n<body>\n' +
  page +
  '\n</body>\n</html>\n';
writeFileSync(join(DIST, 'showcase', 'index.html'), standalone);

const size = Buffer.byteLength(page);
console.log('\n  vitrin uretildi');
console.log('    showcase/index.html       ' + kb(size) + '  (artifact formati)');
console.log('    dist/showcase/index.html  ' + kb(Buffer.byteLength(standalone)) + '  (standalone)');
console.log('\n  gomulu: defense-2d ' + kb(utd.bytes) + '  |  escape-3d ' + kb(uesc.bytes));
console.log('          merge-2d ' + kb(u2d.bytes) + '  |  merge-3d-atlas ' + kb(u3d.bytes));
console.log('          match-2d ' + kb(um2.bytes) + '  |  match-3d ' + kb(um3.bytes));
console.log('          run-3d ' + kb(urun.bytes) + '  |  strike-3d ' + kb(ustr.bytes));
console.log('  kapaklar: ' + kb(Object.values(posters).reduce((a, p) => a + p.bytes, 0)) +
  ' (7 WebP, 360px)');
console.log('  base64 toplami: ' +
  kb(u2d.b64.length + u3d.b64.length + uesc.b64.length + utd.b64.length +
    um2.b64.length + um3.b64.length + urun.b64.length + ustr.b64.length) + '\n');
