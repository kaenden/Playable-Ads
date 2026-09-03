/** Gerçek Draco sıkıştırma ölçümü — tahmin değil. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const b64 = (n) => Math.ceil(n / 3) * 4;

// Inline edilmesi ZORUNLU decoder maliyetleri (playable'da network isteği yasak)
const DRACO_WASM = statSync('node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm').size;
const DRACO_WRAP = statSync('node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js').size;
const KTX_WASM = statSync('node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm').size;
const KTX_JS = statSync('node_modules/three/examples/jsm/libs/basis/basis_transcoder.js').size;
const DRACO_COST = DRACO_WASM + DRACO_WRAP;
const KTX_COST = KTX_WASM + KTX_JS;

console.log('\n  === Draco sıkıştırma, gerçek ölçüm ===\n');
console.log('  MODEL        ham GLB    +Draco    kazanç    b64 kazanç');
console.log('  ' + '-'.repeat(58));

let bestSaving = 0;
for (const name of ['lowpoly', 'normal', 'highpoly']) {
  const f = 'build/tmp-' + name + '.glb';
  const doc = await io.read(f);
  await doc.transform(draco({ method: 'edgebreaker' }));
  const out = await io.writeBinary(doc);
  const raw = readFileSync(f).length;
  const saving = raw - out.length;
  bestSaving = Math.max(bestSaving, saving);
  console.log('  ' + name.padEnd(12) + kb(raw).padStart(9) + kb(out.length).padStart(10) +
    kb(saving).padStart(10) + kb(b64(saving)).padStart(12));
}

console.log('\n  === Inline decoder maliyeti (playable network isteği yapamaz) ===\n');
console.log('  Draco decoder (wasm + wrapper):  ' + kb(DRACO_COST) + '  -> base64 ' + kb(b64(DRACO_COST)));
console.log('  KTX2 transcoder (wasm + js):     ' + kb(KTX_COST) + '  -> base64 ' + kb(b64(KTX_COST)));
console.log('\n  En iyi Draco kazancı (base64):   ' + kb(b64(bestSaving)));
console.log('  NET SONUÇ: ' + (b64(bestSaving) > b64(DRACO_COST)
  ? 'Draco kârda'
  : 'Draco ZARARDA — decoder kazancı ' + kb(b64(DRACO_COST) - b64(bestSaving)) + ' aşıyor'));

// Başabaş noktası
console.log('\n  Başabaş: Draco ~%60 kazandırıyorsa, geometri yükü');
console.log('  ' + kb(DRACO_COST / 0.6) + " ham GLB'yi aşmadan Draco kendini ödemiyor.");
console.log('  KTX2 ~%80 kazandırıyorsa, texture yükü');
console.log('  ' + kb(KTX_COST / 0.8) + ' ham texture aşmadan KTX2 kendini ödemiyor.\n');
