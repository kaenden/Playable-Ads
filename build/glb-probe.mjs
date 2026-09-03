/**
 * GLB deneyi: prosedürel ejderhayı gerçek bir GLB'ye export edip
 * Draco/KTX2 matematiğini playable ölçeğinde tartıyoruz.
 */
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Node'da FileReader yok; GLTFExporter Blob'u okumak için kullanıyor.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      if (this.onloadend) this.onloadend();
    });
  }
};

function mat(c) { return new T.MeshPhongMaterial({ color: new T.Color(c), shininess: 22 }); }

function dragon(r, seg) {
  const g = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(r * 0.86, seg, seg * 0.75), mat(0xef7a34));
  body.position.y = -r * 0.28; g.add(body);
  const head = new T.Mesh(new T.SphereGeometry(r * 0.78, seg, seg * 0.75), mat(0xef7a34));
  head.position.y = r * 0.58; g.add(head);
  const snout = new T.Mesh(new T.SphereGeometry(r * 0.34, seg * 0.7, seg * 0.5), mat(0xef7a34));
  snout.position.set(0, r * 0.42, r * 0.62); g.add(snout);
  for (const d of [-1, 1]) {
    const h = new T.Mesh(new T.ConeGeometry(r * 0.17, r * 0.55, 10), mat(0xfbe6c0));
    h.position.set(d * r * 0.5, r * 1.1, 0); g.add(h);
    const s = new T.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(r * 1.1, r * 0.95, r * 1.35, r * 0.05);
    s.quadraticCurveTo(r * 0.95, r * 0.05, r * 1.0, -r * 0.45);
    s.quadraticCurveTo(r * 0.55, -r * 0.2, 0, -r * 0.35);
    const w = new T.Mesh(new T.ShapeGeometry(s), new T.MeshPhongMaterial({ color: 0x8f2b06, side: T.DoubleSide }));
    w.position.set(d * r * 0.72, r * 0.18, -r * 0.1); w.scale.x = d; g.add(w);
    const e = new T.Mesh(new T.SphereGeometry(r * 0.19, 14, 10), mat(0xffffff));
    e.position.set(d * r * 0.3, r * 0.62, r * 0.72); g.add(e);
  }
  return g;
}

function tris(group) {
  let n = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      const gm = o.geometry;
      n += gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3;
    }
  });
  return Math.round(n);
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function exportGlb(group, name) {
  const ex = new GLTFExporter();
  const buf = await new Promise((res, rej) => ex.parse(group, res, rej, { binary: true }));
  const b = Buffer.from(buf);
  writeFileSync('build/tmp-' + name + '.glb', b);
  const b64 = b.toString('base64').length;
  return { raw: b.length, gzip: gzipSync(b).length, b64 };
}

const cases = [
  ['lowpoly', dragon(1, 12)],
  ['normal', dragon(1, 26)],
  ['highpoly', dragon(1, 64)],
];

console.log('\n  MODEL        üçgen      GLB ham     GLB gzip   base64 (inline)');
console.log('  ' + '-'.repeat(68));
for (const [name, g] of cases) {
  const r = await exportGlb(g, name);
  console.log('  ' + name.padEnd(12) + String(tris(g)).padStart(6) + '  ' +
    kb(r.raw).padStart(11) + '  ' + kb(r.gzip).padStart(10) + '  ' + kb(r.b64).padStart(14));
}
