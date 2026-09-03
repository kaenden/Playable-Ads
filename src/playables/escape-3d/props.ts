/**
 * Prosedürel 3D geometri — bu playable'da da tek bir model DOSYASI yok.
 *
 * Merge'in 3D'sinde ölçtüğümüz sonucun doğrudan uygulaması: GLTFLoader'ın
 * giriş bedeli (~400 KB) tek modelde geri gelmiyor, on modelde geliyor.
 * Buradaki bütün sahne — araçlar, ada, ağaçlar, koniler — birkaç yüz satır
 * kodla üretiliyor ve bundle'a maliyeti sadece o kod.
 *
 * Görsel dil: yuvarlatılmış kenarlar (oyuncak hissi), doygun renk, tek yönlü
 * güçlü ışık + yumuşak gölge. Merge'in gece paletinin tam tersi; portföyde
 * iki birim aynı görünmemeli.
 */
import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Shape,
  SphereGeometry,
} from 'three';

/**
 * Köşeleri ve kenarları yuvarlatılmış kutu.
 *
 * three'nin çekirdeğinde RoundedBoxGeometry yok (examples/ altında ve orası
 * ayrı bir dosya). Shape + ExtrudeGeometry ile bevel açmak hem daha az kod
 * hem tam istediğimiz şey: köşeler yarıçaplı, kenarlar pahlı.
 *
 * Sonuç taban y=0'da duruyor, yükseklik +y yönünde.
 */
export function roundedBox(w: number, d: number, h: number, r: number, bevel: number): BufferGeometry {
  const rr = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  const x = w / 2 - rr;
  const z = d / 2 - rr;
  const s = new Shape();
  s.moveTo(-x, -z - rr);
  s.lineTo(x, -z - rr);
  s.absarc(x, -z, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + rr, z);
  s.absarc(x, z, rr, 0, Math.PI / 2, false);
  s.lineTo(-x, z + rr);
  s.absarc(-x, z, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-x - rr, -z);
  s.absarc(-x, -z, rr, Math.PI, Math.PI * 1.5, false);

  const b = Math.min(bevel, h / 2 - 0.001);
  const g = new ExtrudeGeometry(s, {
    depth: Math.max(0.001, h - b * 2),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 6,
    steps: 1,
  });
  // Shape XY düzleminde, ekstrüzyon +Z'de. Sahnede yukarı +Y olmalı.
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  g.computeVertexNormals();
  return g;
}

/** Tekerlek geometrisi tek kez üretilip bütün araçlarda paylaşılıyor. */
const WHEEL = new CylinderGeometry(0.135, 0.135, 0.1, 14);
WHEEL.rotateX(Math.PI / 2);
const WHEEL_MAT = new MeshPhongMaterial({ color: 0x232032, shininess: 12 });
const HUB_MAT = new MeshPhongMaterial({ color: 0xd8dbe6, shininess: 40 });
const GLASS_MAT = new MeshPhongMaterial({ color: 0x9fd8ff, shininess: 90, specular: 0x666666 });
const LAMP_MAT = new MeshPhongMaterial({ color: 0xffe9a8, emissive: 0x554400 });
const TAIL_MAT = new MeshPhongMaterial({ color: 0xff5a4a, emissive: 0x440000 });

/** Uzunluğa göre gövde geometrisi cache'leniyor: 7 araç, 2 farklı boy. */
const bodyCache: Record<string, BufferGeometry> = {};
function bodyGeo(len: number): BufferGeometry {
  const k = 'b' + len;
  if (!bodyCache[k]) bodyCache[k] = roundedBox(len * 0.94, 0.78, 0.3, 0.16, 0.05);
  return bodyCache[k];
}
function cabinGeo(len: number): BufferGeometry {
  const k = 'c' + len;
  if (!bodyCache[k]) bodyCache[k] = roundedBox(len * (len > 2 ? 0.52 : 0.46), 0.66, 0.26, 0.13, 0.05);
  return bodyCache[k];
}

/**
 * Araç +X yönüne bakacak şekilde üretiliyor; sahnede yön farkı sadece
 * rotation.y ile veriliyor. Tek yön üretmek, dört yön için ayrı geometri
 * tutmaktan hem daha az kod hem daha az bellek.
 */
export function buildCar(len: number, color: string): Group {
  const g = new Group();
  const c = new Color(color);
  const dark = c.clone().multiplyScalar(0.62);

  const bodyMat = new MeshPhongMaterial({ color: c, shininess: 55, specular: 0x333333 });
  const cabinMat = new MeshPhongMaterial({ color: c.clone().lerp(new Color(0xffffff), 0.18), shininess: 55 });

  const body = new Mesh(bodyGeo(len), bodyMat);
  body.position.y = 0.12;
  body.castShadow = true;
  g.add(body);

  const cabin = new Mesh(cabinGeo(len), cabinMat);
  // Kabin hafif geride: aracın burnu belli olsun, hangi yöne çıkacağı okunsun.
  cabin.position.set(-len * 0.06, 0.4, 0);
  cabin.castShadow = true;
  g.add(cabin);

  // Ön cam — kabinin burnuna yaslı ince bir dilim.
  const glass = new Mesh(roundedBox(len * 0.1, 0.56, 0.19, 0.05, 0.02), GLASS_MAT);
  glass.position.set(-len * 0.06 + len * (len > 2 ? 0.26 : 0.23), 0.46, 0);
  g.add(glass);

  // Alt gölge şeridi: gövdeyi yerden ayırıyor, "yüzen kutu" hissini kırıyor.
  const skirt = new Mesh(roundedBox(len * 0.9, 0.7, 0.08, 0.14, 0.02), new MeshPhongMaterial({ color: dark }));
  skirt.position.y = 0.07;
  g.add(skirt);

  const wx = len * 0.3;
  for (const sx of [-wx, wx]) {
    for (const sz of [-0.4, 0.4]) {
      const w = new Mesh(WHEEL, WHEEL_MAT);
      w.position.set(sx, 0.135, sz);
      w.castShadow = true;
      g.add(w);
      const hub = new Mesh(WHEEL, HUB_MAT);
      hub.scale.set(0.45, 0.45, 1.08);
      hub.position.set(sx, 0.135, sz);
      g.add(hub);
    }
  }

  // Farlar önde, stoplar arkada — yön okunabilirliğinin son katmanı.
  for (const sz of [-0.24, 0.24]) {
    const lamp = new Mesh(new SphereGeometry(0.055, 8, 6), LAMP_MAT);
    lamp.position.set(len * 0.46, 0.24, sz);
    g.add(lamp);
    const tail = new Mesh(new SphereGeometry(0.045, 8, 6), TAIL_MAT);
    tail.position.set(-len * 0.46, 0.24, sz);
    g.add(tail);
  }

  return g;
}

/** Trafik konisi — adanın kenarlarını süslüyor, sahneye ölçek veriyor. */
export function buildCone(): Group {
  const g = new Group();
  const base = new Mesh(roundedBox(0.3, 0.3, 0.06, 0.06, 0.02), new MeshLambertMaterial({ color: 0xe86a1e }));
  g.add(base);
  const body = new Mesh(new CylinderGeometry(0.04, 0.13, 0.34, 10), new MeshLambertMaterial({ color: 0xf2762b }));
  body.position.y = 0.22;
  body.castShadow = true;
  g.add(body);
  const band = new Mesh(new CylinderGeometry(0.088, 0.098, 0.06, 10), new MeshLambertMaterial({ color: 0xffffff }));
  band.position.y = 0.24;
  g.add(band);
  return g;
}

/** Ağaç: gövde + iki kademeli yaprak. Düşük poligon, yüksek siluet. */
export function buildTree(scale: number): Group {
  const g = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.09, 0.12, 0.5, 8), new MeshLambertMaterial({ color: 0x8a5a3b }));
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new MeshLambertMaterial({ color: 0x3fa85f });
  const l1 = new Mesh(new IcosahedronGeometry(0.36, 0), leafMat);
  l1.position.y = 0.66;
  l1.castShadow = true;
  g.add(l1);
  const l2 = new Mesh(new IcosahedronGeometry(0.26, 0), new MeshLambertMaterial({ color: 0x4dc06f }));
  l2.position.set(0.1, 0.94, -0.05);
  l2.castShadow = true;
  g.add(l2);
  g.scale.setScalar(scale);
  return g;
}

/**
 * Asfalt dokusu — park yerleri.
 *
 * Bu sadece süs değil: ızgarayı çizmek oyunun KURALINI görünür kılıyor.
 * Oyuncu "beş kere beş kutu var, araçlar kutuları kaplıyor" bilgisini
 * yazıdan değil zeminden okuyor.
 */
export function lotTexture(cols: number, rows: number): CanvasTexture {
  // Doku boyutu ve gren sayısı İLK KAREYİ doğrudan etkiliyor: ilk sürümde
  // hücre başına 220 nokta çiziliyordu (5500 fillRect) ve ölçüm bunu gösterdi.
  const px = 96;
  const cv = document.createElement('canvas');
  cv.width = cols * px;
  cv.height = rows * px;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;

  g.fillStyle = '#3C4457';
  g.fillRect(0, 0, cv.width, cv.height);

  // Asfalt greni — düz dolgu plastik görünüyor.
  for (let i = 0; i < cols * rows * 45; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
    const r = Math.random() * 2.2;
    g.fillRect(Math.random() * cv.width, Math.random() * cv.height, r, r);
  }

  // Park yeri çizgileri
  g.strokeStyle = 'rgba(240,244,255,.5)';
  g.lineWidth = px * 0.055;
  const m = px * 0.1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.strokeRect(c * px + m, r * px + m, px - m * 2, px - m * 2);
    }
  }
  g.strokeStyle = 'rgba(255,214,90,.75)';
  g.lineWidth = px * 0.075;
  g.strokeRect(px * 0.045, px * 0.045, cv.width - px * 0.09, cv.height - px * 0.09);

  const t = new CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}
