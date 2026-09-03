/**
 * Yaratıkları GLB'ye dışa aktarır — "prosedürel vs asset" karşılaştırmasının
 * adil olması için ikisi de AYNI geometriden çıkıyor.
 *
 *   node build/export-creatures.mjs
 *
 * creatures.ts tarayıcıda da Node'da da çalışıyor (DOM kullanmıyor), o yüzden
 * esbuild ile geçici bir .mjs'e bundle'layıp doğrudan import ediyoruz. Geometri
 * kodunu ikinci kez yazmak yerine tek kaynaktan besleniyor.
 */
import esbuild from 'esbuild';
import { Scene } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Node'da FileReader yok; GLTFExporter Blob okumak için kullanıyor.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      if (this.onloadend) this.onloadend();
    });
  }
};

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src', 'playables', 'merge-3d', 'creatures.ts');
const TMP = join(ROOT, 'assets-lab', '.creatures.tmp.mjs');
const OUT = join(ROOT, 'assets-lab', 'in-3d-creatures');

/** Sprite'ın hücreye göre ölçeği; view3d ile aynı olsun diye sabit. */
const CELL = 100;
const NAMES = ['Level1_Egg', 'Level2_Cracked', 'Level3_Hatchling', 'Level4_Wyrmling', 'Level5_Dragon'];

mkdirSync(dirname(TMP), { recursive: true });
await esbuild.build({
  entryPoints: [SRC],
  bundle: true,
  format: 'esm',
  platform: 'node',
  external: ['three'],
  outfile: TMP,
  logLevel: 'silent',
});

const { creature } = await import(pathToFileURL(TMP).href);

const scene = new Scene();
for (let lv = 1; lv <= 5; lv++) {
  const g = creature(lv, CELL);
  g.name = NAMES[lv - 1];
  // Işıklar GLB'ye girmesin: sahne aydınlatması playable tarafında kuruluyor.
  const lights = [];
  g.traverse((o) => {
    if (o.isLight) lights.push(o);
  });
  for (const l of lights) l.parent.remove(l);
  g.position.set((lv - 3) * CELL * 1.4, 0, 0);
  scene.add(g);
}

const exporter = new GLTFExporter();
const buf = await new Promise((res, rej) => exporter.parse(scene, res, rej, { binary: true }));

mkdirSync(OUT, { recursive: true });
const dest = join(OUT, 'creatures.glb');
writeFileSync(dest, Buffer.from(buf));

let tris = 0;
scene.traverse((o) => {
  if (o.isMesh) {
    const gm = o.geometry;
    tris += gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3;
  }
});

if (existsSync(TMP)) rmSync(TMP);

console.log('\n  5 yaratık -> ' + dest);
console.log('  ' + (buf.byteLength / 1024).toFixed(1) + ' KB   ' + Math.round(tris).toLocaleString() + ' üçgen');
console.log('  Sonraki: bu dosyayı assets-lab/in-3d/ altına koyup `npm run assets:3d` ile optimize et.\n');
