/**
 * `dist/site/` -> `docs/`
 *
 * GitHub Pages `main` dalının `docs/` klasörünü servis ediyor, o yüzden
 * yayınlanacak çıktının depoya girmesi gerekiyor. `dist/` gitignore'da;
 * `docs/` bilerek değil — yayında hangi sürümün durduğu depoda görünsün.
 *
 * `.nojekyll` şart: Pages varsayılan olarak Jekyll çalıştırıyor ve alt
 * çizgiyle başlayan dosya/klasörleri atıyor. Bu dosya onu kapatıyor.
 */
import { cpSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'dist', 'site');
const DST = join(ROOT, 'docs');

if (!existsSync(SRC)) {
  console.error('dist/site yok. Once `npm run site` calistir.');
  process.exit(1);
}
rmSync(DST, { recursive: true, force: true });
cpSync(SRC, DST, { recursive: true });
writeFileSync(join(DST, '.nojekyll'), '');
console.log('\n  docs/ guncellendi -> simdi: git add -A && git commit && git push\n');
