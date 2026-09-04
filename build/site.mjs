/**
 * Yayınlanabilir SİTE çıktısı.
 *
 *   node build/site.mjs
 *   node build/site.mjs --base https://alanadin.com
 *
 * Vitrinin iki teslimat biçimi var ve ikisi AYNI şablondan çıkıyor:
 *
 *   showcase/index.html   -> tek dosya. Her birim base64 olarak içinde;
 *                            artifact/e-posta eki gibi yerlerde tek parça
 *                            olmak zorunda. 5.3 MB.
 *   dist/site/            -> gerçek site. Sayfa açılışta 7 KAPAK indiriyor
 *                            (97 KB); oyunun 800 KB'ı ancak tıklanınca
 *                            geliyor ve kendi adresinden.
 *
 * Site biçiminin başvuru açısından üç somut faydası var:
 *
 *   1. İLK AÇILIŞ HIZLI. Telefonda mobil veriyle 5.3 MB'lık tek sayfa
 *      açtırmak, işi görmeden vazgeçilen bir bekleme demek.
 *   2. HER BİRİMİN KENDİ LİNKİ VAR. "Şu runner'a bak" diye tek bir birimi
 *      göndermek mümkün; ilan sahibi de tam ekran açabiliyor.
 *   3. ÖNİZLEME GÖRSELİ. Link Slack'e, LinkedIn'e ya da e-postaya
 *      yapıştırıldığında kart olarak açılıyor. Çıplak link tıklanmıyor.
 *
 * `--base` verilmezse önizleme adresleri GÖRECELİ yazılıyor; bazı
 * platformlar göreceli og:image'i okumuyor. Alan adı belli olduğunda bu
 * bayrakla bir kez daha üretmek gerekiyor.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadIdentity, identityVars } from './identity.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'site');
const TEMPLATE = join(ROOT, 'showcase', 'template.html');
const POSTERS = join(ROOT, 'showcase', 'posters');
const LOGOS = join(ROOT, 'showcase', 'logos');

const argv = process.argv.slice(2);
const BASE = (argv.indexOf('--base') >= 0 ? argv[argv.indexOf('--base') + 1] : '').replace(/\/$/, '');

const LIMIT = 5 * 1024 * 1024;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const pctStr = (n) => {
  const p = (n / LIMIT) * 100;
  return (p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%';
};

/**
 * Birimler. `key` şablondaki yer tutucu, `slug` adres, `dist` build klasörü.
 * Adresler oyunun ADIYLA: `/u/gate-crashers/` bir insana bir şey söylüyor,
 * `/u/run-3d/` söylemiyor.
 */
const UNITS = [
  { key: 'run', slug: 'gate-crashers', was: ['crowd-rush'], dist: 'run-3d', poster: 'run-3d', name: 'Gate Crashers', genre: '3D runner', engine: 'Three.js' },
  { key: 'str', slug: 'blade-rush', dist: 'strike-3d', poster: 'strike-3d', name: 'Blade Rush', genre: '3D action runner', engine: 'Three.js' },
  { key: 'esc', slug: 'valet-panic', was: ['traffic-escape'], dist: 'escape-3d-atlas', poster: 'escape-3d', name: 'Valet Panic', genre: 'Block puzzle', engine: 'Three.js' },
  { key: 'm3', slug: 'order-up-3d', was: ['sweet-match-3d'], logo: 'order-up', dist: 'match-3d', poster: 'match-3d', name: 'Order Up 3D', genre: 'Match-3', engine: 'Three.js' },
  { key: 'm2', slug: 'order-up', was: ['sweet-match'], dist: 'match-2d', poster: 'match-2d', name: 'Order Up', genre: 'Match-3', engine: 'Canvas 2D' },
];

/** Ağ paketleri: indirilebilir olanlar. Kreatifin teslim biçimi budur. */
const ZIPS = ['google', 'ironsource', 'mintegral', 'tiktok'];

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Kunye kontrolu EN BASTA: isim bossa burada duruyoruz. Asagidaki rmSync
// dist/site'i sildigi icin, gec kalan bir hata calisan ciktiyi da goturur.
const IDENT = identityVars(loadIdentity(ROOT), true);

rmSync(OUT, { recursive: true, force: true });
for (const d of ['u', 'covers', 'og', 'dl', 'logos']) mkdirSync(join(OUT, d), { recursive: true });

/**
 * Vitrinden ÇIKARILAN birimlerin eski adresleri.
 *
 * Bir birim portfolyodan kalktığında adresi de ölüyor ve paylaşılmış her
 * link 404 veriyor. Yeniden adlandırmada olduğu gibi burada da eski yol
 * yerinde kalıyor — tek fark, gidecek bir birim olmadığı için ana sayfaya
 * yönlendirmesi.
 */
const RETIRED = ['merge-dragons', 'merge-dragons-3d', 'tower-rush'];
for (const slug of RETIRED) {
  mkdirSync(join(OUT, 'u', slug), { recursive: true });
  writeFileSync(
    join(OUT, 'u', slug, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Playable Ads Lab</title>' +
      '<link rel="canonical" href="../../">' +
      '<meta http-equiv="refresh" content="0; url=../../">' +
      '<meta name="robots" content="noindex">' +
      '<p>This unit is no longer part of the portfolio. ' +
      '<a href="../../">See the current work</a>.</p>'
  );
}

// ---------------------------------------------------------------- birimler
const vars = {};
let coverBytes = 0;
let unitBytes = 0;

for (const u of UNITS) {
  const src = join(DIST, u.dist, 'showcase', 'index.html');
  if (!existsSync(src)) {
    console.error('Eksik build: ' + src + '\nOnce `npm run build:assets` calistir.');
    process.exit(1);
  }

  // Kapak: sitede DOSYA olarak duruyor, data URI olarak değil. Sayfanın
  // kendisi küçük kalsın diye — tarayıcı da bunları ayrıca önbelleğe alıyor.
  const cover = await sharp(join(POSTERS, u.poster + '.png'))
    .resize({ width: 360 })
    .webp({ quality: 76 })
    .toBuffer();
  writeFileSync(join(OUT, 'covers', u.slug + '.webp'), cover);
  coverBytes += cover.length;

  // Logo — varsa. Şimdilik iki birimde var; kapakla aynı mantık, dosya
  // olarak duruyor ve saydamlığı korunuyor.
  // Logo dosyası varsayılan olarak slug'la aynı; match-3 çiftinde iki birim
  // TEK logoyu paylaşıyor, o yüzden `logo` alanıyla ezilebiliyor.
  const logoName = u.logo || u.slug;
  const logoSrc = join(LOGOS, logoName + '.webp');
  if (existsSync(logoSrc)) {
    const lg = await sharp(logoSrc)
      .resize({ width: 420, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 92 })
      .toBuffer();
    writeFileSync(join(OUT, 'logos', logoName + '.webp'), lg);
    coverBytes += lg.length;
  }

  // Önizleme kartı: 1200x630, kapağın kendisi koyu zemine oturtulmuş.
  const og = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: '#0E1424' },
  })
    .composite([
      {
        input: await sharp(join(POSTERS, u.poster + '.png')).resize({ height: 560 }).toBuffer(),
        gravity: 'center',
      },
    ])
    // JPEG: önizleme kartı fotoğrafik bir bileşim, PNG'de 250 KB tutuyordu.
    // Bunu sadece link tarayıcıları indiriyor ama depoda da duruyor.
    .jpeg({ quality: 84 })
    .toBuffer();
  writeFileSync(join(OUT, 'og', u.slug + '.jpg'), og);

  // Oyun sayfası: paketin KENDİSİ, sadece başlığına önizleme etiketleri
  // ekleniyor. Ağ paketleri bu etiketleri ALMIYOR — orada fazladan tek bir
  // bayt bile bütçeden yiyor ve container zaten link önizlemesi yapmıyor.
  let page = readFileSync(src, 'utf8');
  const url = BASE ? BASE + '/u/' + u.slug + '/' : '';
  const meta = [
    '<meta name="description" content="' + esc(u.name + ' — ' + u.genre + ' playable ad unit, ' + u.engine + ', single HTML file.') + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + esc(u.name + ' — playable ad unit') + '">',
    '<meta property="og:description" content="' + esc(u.genre + ' · ' + u.engine + ' · one HTML file, no network requests.') + '">',
    '<meta property="og:image" content="' + (BASE ? BASE : '..') + '/og/' + u.slug + '.jpg">',
    url ? '<meta property="og:url" content="' + url + '">' : '',
    '<meta name="twitter:card" content="summary_large_image">',
  ].filter(Boolean).join('\n');
  page = page.replace('</head>', meta + '\n</head>');
  mkdirSync(join(OUT, 'u', u.slug), { recursive: true });
  writeFileSync(join(OUT, 'u', u.slug, 'index.html'), page);

  // ESKİ ADRES ÖLMESİN. Bir birim yeniden adlandırıldığında paylaşılmış
  // linkler 404 veriyor; portfolyoda kırık link, olmayan projeden kötü.
  // Eski yol yerinde kalıyor ve yenisine yönlendiriyor — statik barındırmada
  // yönlendirme kuralı yazılamadığı için meta refresh + canonical.
  for (const old of u.was || []) {
    mkdirSync(join(OUT, 'u', old), { recursive: true });
    writeFileSync(
      join(OUT, 'u', old, 'index.html'),
      '<!doctype html><meta charset="utf-8">' +
        '<title>' + esc(u.name) + '</title>' +
        '<link rel="canonical" href="../' + u.slug + '/">' +
        '<meta http-equiv="refresh" content="0; url=../' + u.slug + '/">' +
        '<meta name="robots" content="noindex">' +
        '<p>Moved to <a href="../' + u.slug + '/">' + esc(u.name) + '</a>.</p>'
    );
  }
  unitBytes += Buffer.byteLength(page);

  const K = u.key.toUpperCase();
  vars['%%HREF_' + K + '%%'] = 'u/' + u.slug + '/';
  vars['%%POSTER_' + K + '%%'] = 'covers/' + u.slug + '.webp';
  vars['%%LOGO_' + K + '%%'] = existsSync(join(LOGOS, (u.logo || u.slug) + '.webp'))
    ? 'logos/' + (u.logo || u.slug) + '.webp'
    : '';
  vars['%%B64_' + K + '%%'] = '';
  vars['%%SIZE_' + K + '%%'] = kb(statSync(src).size);
  vars['%%PCT_' + K + '%%'] = pctStr(statSync(src).size);

  for (const net of ZIPS) {
    const z = join(DIST, u.dist, net + '.zip');
    if (existsSync(z)) copyFileSync(z, join(OUT, 'dl', u.slug + '-' + net + '.zip'));
  }
}

// Site önizlemesi: dört kapak yan yana.
const strip = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0E1424' } })
  .composite(
    await Promise.all(
      UNITS.slice(0, 4).map(async (u, i) => ({
        input: await sharp(join(POSTERS, u.poster + '.png')).resize({ height: 470 }).toBuffer(),
        top: 80,
        left: 60 + i * 275,
      }))
    )
  )
  .jpeg({ quality: 84 })
  .toBuffer();
writeFileSync(join(OUT, 'og', 'site.jpg'), strip);

// ---------------------------------------------------------------- indirmeler
const rows = UNITS.map((u) => {
  const links = ZIPS.filter((n) => existsSync(join(OUT, 'dl', u.slug + '-' + n + '.zip')))
    .map((n) => '<a href="dl/' + u.slug + '-' + n + '.zip" download>' + n + '</a>')
    .join(' ');
  return '      <tr><td>' + esc(u.name) + '</td><td class="num">' + vars['%%SIZE_' + u.key.toUpperCase() + '%%'] +
    '</td><td class="dl">' + links + '</td></tr>';
}).join('\n');

vars['%%DOWNLOADS%%'] =
  '<section class="downloads">\n  <div class="wrap">\n' +
  '    <p class="eyebrow">Packages</p>\n' +
  '    <p style="font-size:14px;color:var(--muted);max-width:62ch;margin-bottom:14px">\n' +
  '      What actually ships to a network: one HTML file, zipped where the network wants a zip.\n' +
  '      Every unit is packaged for ten networks; four of them are here to download.\n' +
  '    </p>\n' +
  '    <div class="tablewrap"><table>\n' +
  '      <thead><tr><th>Unit</th><th>Size</th><th>Download</th></tr></thead>\n' +
  '      <tbody>\n' + rows + '\n      </tbody>\n' +
  '    </table></div>\n  </div>\n</section>';

// ---------------------------------------------------------------- sayfa
const posterMeta = {
  '%%RUN_RAW%%': kb(224.0 * 1024),
  '%%RUN_GLB%%': kb(105.5 * 1024),
  '%%RUN_CALLS%%': '81',
};
const shared = {
  ...posterMeta,
  ...IDENT,
  '%%DELTA_RS%%': kb(Math.abs(
    statSync(join(DIST, 'strike-3d', 'showcase', 'index.html')).size -
    statSync(join(DIST, 'run-3d', 'showcase', 'index.html')).size)),
  '%%RATIO_M%%': (statSync(join(DIST, 'match-3d', 'showcase', 'index.html')).size /
    statSync(join(DIST, 'match-2d', 'showcase', 'index.html')).size).toFixed(1) + '×',
  // Meta'nin 2 MB index siniri: 3D birimin ona gore yeri.
  '%%PCT_META_M3%%': ((statSync(join(DIST, 'match-3d', 'showcase', 'index.html')).size /
    (2 * 1024 * 1024)) * 100).toFixed(1) + '%',
  '%%BUILD%%': 'build ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
  /**
   * SİTEDE NOTLAR AYRI SAYFADA.
   *
   * Ana sayfanın işi işi göstermek; sekiz bin kelimelik mühendislik yazısı
   * onu bir makaleye çeviriyordu. Sitede o içerik `/notes/` altına iniyor
   * ve ana sayfada yerinde tek bir bağlantı kalıyor. Artifact tek dosya
   * olduğu için orada aynı içerik sayfanın altına gömülü kalıyor —
   * gidecek bir sayfa yok.
   */
  '%%NOTES%%':
    '<section class="more"><div class="wrap">' +
    '<a class="morelink" href="notes/">' +
    '<span class="k">Build notes</span>' +
    '<span class="d">How each unit is put together, what it cost, and what went wrong on the way</span>' +
    '<span class="ar" aria-hidden="true">&rarr;</span>' +
    '</a></div></section>',
};

let body = readFileSync(TEMPLATE, 'utf8');
for (const [k, v] of Object.entries({ ...vars, ...shared })) body = body.split(k).join(v);

const left = body.match(/%%[A-Z_0-9]*%%/g);
if (left) {
  console.error('Doldurulmamis yer tutucu: ' + [...new Set(left)].join(', '));
  process.exit(1);
}

const ogUrl = (BASE ? BASE : '.') + '/og/site.jpg';
const html =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  '<title>Playable Ads Lab — five units, one pipeline</title>\n' +
  '<meta name="description" content="Five playable ad units built from supplied art: two 3D runners, a block puzzle and a match-3 in both renderers. Each one a single HTML file with no network requests.">\n' +
  '<meta property="og:type" content="website">\n' +
  '<meta property="og:title" content="Playable Ads Lab — five units, one pipeline">\n' +
  '<meta property="og:description" content="Four mechanics, ten ad networks. Every unit is a single HTML file that makes no network requests. Tap a cover to play it.">\n' +
  '<meta property="og:image" content="' + ogUrl + '">\n' +
  (BASE ? '<meta property="og:url" content="' + BASE + '/">\n' : '') +
  '<meta name="twitter:card" content="summary_large_image">\n' +
  '<style>html,body{margin:0}img{max-width:100%}</style>\n' +
  '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
writeFileSync(join(OUT, 'index.html'), html);

// --- notlar sayfasi: ayni kabuk, govdesi notes.html
{
  // Kabuk ana sayfanın kendisinden çıkıyor: font bağlantıları, stil bloğu
  // ve künye şeridi. İkinci bir kopya tutmak iki sayfanın zamanla
  // ayrışması demek olurdu.
  const head = body.slice(0, body.indexOf('<main'));
  let notes = readFileSync(join(ROOT, 'showcase', 'notes.html'), 'utf8');
  for (const [k, v] of Object.entries({ ...vars, ...shared })) notes = notes.split(k).join(v);
  const back =
    '<div class="wrap" style="padding-top:26px">' +
    '<a class="morelink back" href="../"><span class="ar" aria-hidden="true">&larr;</span>' +
    '<span class="k">Back to the units</span></a></div>';
  const notesHtml =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>Build notes — Playable Ads Lab</title>\n' +
    '<meta name="description" content="How each playable ad unit is put together: rendering, asset pipeline, size budget and the mistakes found on the way.">\n' +
    '<style>html,body{margin:0}img{max-width:100%}</style>\n' +
    '</head>\n<body>\n' + head + back + notes + back + '\n</body>\n</html>\n';
  mkdirSync(join(OUT, 'notes'), { recursive: true });
  writeFileSync(join(OUT, 'notes', 'index.html'), notesHtml);
  console.log('    notes/            ' + kb(Buffer.byteLength(notesHtml)));
}

console.log('\n  site uretildi -> ' + OUT);
console.log('    index.html        ' + kb(Buffer.byteLength(html)) + '  (kapaklar dahil degil)');
console.log('    covers/           ' + kb(coverBytes) + '  (' + UNITS.length + ' WebP)');
console.log('    u/<slug>/         ' + kb(unitBytes) + '  (' + UNITS.length + ' birim, tikaninca yukleniyor)');
console.log('\n  ILK ACILIS: ' + kb(Buffer.byteLength(html) + coverBytes) +
  '   (tek dosya vitrinde 5.3 MB idi)');
if (!BASE) {
  console.log('\n  NOT: --base verilmedi, onizleme adresleri goreceli yazildi.');
  console.log('       Alan adi belli olunca: node build/site.mjs --base https://alanadin.com');
}
console.log('');
