/**
 * Model -> sprite: tek dosyalık bir render sayfası üretir.
 *
 *   node build/render-sprites.mjs --glb out-3d-food/food.glb --out in-2d-food
 *
 * Sayfayı tarayıcıda açmak yeterli; `window.__sprites` içine her modelin
 * PNG data URL'i düşüyor. Aynı komut `--collect <json>` ile çağrıldığında
 * o veriyi PNG dosyalarına yazıyor.
 *
 * NEDEN AYRI BİR ADIM: bu bir build adımı değil, bir kerelik SANAT adımı.
 * Çıktısı 2D hattının girdisi olarak saklanıyor; her derlemede yeniden
 * render etmek hem gereksiz hem de tarayıcı gerektirir.
 */
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const argS = (k, d) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);

const GLB = argS('--glb', 'out-3d-food/food.glb');
const OUT = argS('--out', 'in-2d-food');
const COLLECT = argS('--collect', null);

const outDir = join(ROOT, 'assets-lab', OUT);

if (COLLECT) {
  // Tarayıcıdan alınan { ad: dataURL } sözlüğünü PNG'lere yazar.
  //
  // İki savunma var, ikisi de gerçek çıktıdan öğrenildi:
  //  - Bazı araçlar JSON'u string olarak bir kez daha sarıyor; sonuç string
  //    çıkarsa bir kez daha parse ediliyor.
  //  - GLB birleştirme adımı çakışan isimlere `_1` gibi son ek koyuyor.
  //    Sprite dosya adı oyunun kullandığı ad olmalı; son ek atılıyor.
  let data = JSON.parse(readFileSync(COLLECT, 'utf8'));
  if (typeof data === 'string') data = JSON.parse(data);
  data = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.replace(/_\d+$/, ''), v]));
  mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (const [name, url] of Object.entries(data)) {
    const b64 = url.slice(url.indexOf(',') + 1);
    const buf = Buffer.from(b64, 'base64');
    writeFileSync(join(outDir, name + '.png'), buf);
    total += buf.length;
    console.log('  ' + name.padEnd(14) + (buf.length / 1024).toFixed(1) + ' KB');
  }
  console.log('\n  ' + Object.keys(data).length + ' sprite -> assets-lab/' + OUT);
  console.log('  ham toplam ' + (total / 1024).toFixed(1) + ' KB');
  console.log('  Sonraki: node build/assets-2d.mjs --in ' + OUT + ' --out ' + OUT.replace('in-', 'out-') + '\n');
  process.exit(0);
}

const glbPath = join(ROOT, 'assets-lab', ...GLB.split('/'));
if (!existsSync(glbPath)) {
  console.error('GLB yok: ' + glbPath);
  process.exit(1);
}

const bundle = await esbuild.build({
  entryPoints: [join(ROOT, 'build', 'sprite-renderer.js')],
  bundle: true,
  write: false,
  format: 'iife',
  target: ['es2018'],
  define: { __GLB_B64__: JSON.stringify(readFileSync(glbPath).toString('base64')) },
});

const js = bundle.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
const page =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>render</title>' +
  '<style>body{font:14px system-ui;background:#101828;color:#cfe0ff;padding:24px}</style>' +
  '</head><body><p id="log">render ediliyor…</p><script>' + js + '</script></body></html>';

const renderDir = join(ROOT, 'assets-lab', '.render');
mkdirSync(renderDir, { recursive: true });
const dest = join(renderDir, 'sprites.html');
writeFileSync(dest, page);

console.log('\n  render sayfasi hazir: ' + dest);
console.log('  Tarayicida ac, window.__sprites JSON olarak kaydet, sonra:');
console.log('    node build/render-sprites.mjs --collect <sprites.json> --out ' + OUT + '\n');
