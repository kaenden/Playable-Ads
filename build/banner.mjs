/**
 * LinkedIn kapak görseli — 1584x396.
 *
 *   node build/banner.mjs
 *
 * Kapaklar birimlerin GERÇEK ekran görüntüleri; vitrindeki kartlarla aynı
 * kaynak. Çizilmiş bir kapak burada da yalan olurdu.
 *
 * İki kısıt tasarımı belirliyor:
 *   1. Profil fotoğrafı masaüstünde SOL ALTI kapatıyor. O yüzden sola doğru
 *      koyulaşan bir perde var — avatar temiz zemine oturuyor, altındaki
 *      kapak yarım görünmüyor.
 *   2. Mobilde kenarlar kırpılıyor. Kapaklar ortada toplanıyor, kenarlarda
 *      kaybolacak bir şey bırakılmıyor.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const POSTERS = join(ROOT, 'showcase', 'posters');

const W = 1584, H = 396;
const GROUND = '#0E1424';

// Vitrindeki sırayla: once bagimsiz uc birim, sonra ikililer.
const ORDER = ['run-3d', 'escape-3d', 'defense-2d', 'match-3d', 'match-2d', 'merge-3d', 'merge-2d'];

const CH = 262;               // kapak yuksekligi
const GAP = 18;
const AVATAR = 320;           // solda avatarin oturdugu temiz alan
const cw = Math.round(CH * (500 / 828));
const total = ORDER.length * cw + (ORDER.length - 1) * GAP;
const left0 = AVATAR + Math.round((W - AVATAR - total) / 2);
const top = Math.round((H - CH) / 2);

const covers = await Promise.all(
  ORDER.map(async (name, i) => ({
    input: await sharp(join(POSTERS, name + '.png'))
      .resize({ height: CH })
      .composite([{
        // kapaklarin kosesi yuvarlansin: vitrindeki kartlarla ayni dil
        input: Buffer.from(
          '<svg width="' + cw + '" height="' + CH + '">' +
          '<rect width="' + cw + '" height="' + CH + '" rx="14" ry="14" fill="#fff"/></svg>'
        ),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer(),
    left: left0 + i * (cw + GAP),
    top,
  }))
);

// Sol perde: avatarin oturdugu yer. Sagda da simetrik ve daha zayif bir tane,
// kapak sirasi kenarda kesilmis gibi degil sonlanmis gibi dursun diye.
const scrim = Buffer.from(
  '<svg width="' + W + '" height="' + H + '">' +
  '<defs>' +
  '<linearGradient id="l" x1="0" x2="1">' +
  '<stop offset="0" stop-color="' + GROUND + '" stop-opacity="1"/>' +
  '<stop offset="0.74" stop-color="' + GROUND + '" stop-opacity="1"/>' +
  '<stop offset="1" stop-color="' + GROUND + '" stop-opacity="0"/>' +
  '</linearGradient>' +
  '<linearGradient id="r" x1="1" x2="0">' +
  '<stop offset="0" stop-color="' + GROUND + '" stop-opacity="1"/>' +
  '<stop offset="1" stop-color="' + GROUND + '" stop-opacity="0"/>' +
  '</linearGradient>' +
  '</defs>' +
  '<rect width="' + (AVATAR + 130) + '" height="' + H + '" fill="url(#l)"/>' +
  '<rect x="' + (W - 96) + '" width="96" height="' + H + '" fill="url(#r)"/>' +
  '</svg>'
);

const out = await sharp({ create: { width: W, height: H, channels: 3, background: GROUND } })
  .composite([...covers, { input: scrim, left: 0, top: 0 }])
  .png()
  .toBuffer();

const file = join(ROOT, 'showcase', 'linkedin-banner.png');
writeFileSync(file, out);
console.log('\n  ' + file);
console.log('  ' + W + 'x' + H + '  ' + (out.length / 1024).toFixed(1) + ' KB\n');
