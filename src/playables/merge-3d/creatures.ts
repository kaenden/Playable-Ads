/**
 * Yaratık geometrisi — TEK KAYNAK.
 *
 * Hem tarayıcıda (prosedürel mod) hem Node'da (GLB dışa aktarımı) çalışıyor:
 * içinde DOM kullanımı yok, sadece three primitifleri. build/export-creatures.mjs
 * bu dosyayı bundle'layıp GLB üretiyor, böylece "prosedürel" ve "asset" sürümleri
 * aynı geometriden çıkıyor ve karşılaştırma adil oluyor.
 */
import {
  Group,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry,
  ConeGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  PointLight,
  DoubleSide,
  Color,
} from 'three';

export interface Skin {
  body: number;
  dark: number;
  accent: number;
}

export const SKINS: Skin[] = [
  { body: 0xf3d09a, dark: 0xc9924a, accent: 0xfff4dd },
  { body: 0x7fc0e8, dark: 0x2b6c99, accent: 0xe2f4ff },
  { body: 0x6fc776, dark: 0x256b2c, accent: 0xdcffd4 },
  { body: 0xa06fe0, dark: 0x4d2185, accent: 0xf0dcff },
  { body: 0xef7a34, dark: 0x8f2b06, accent: 0xffe9a8 },
];

function mat(color: number, shininess = 22): MeshPhongMaterial {
  return new MeshPhongMaterial({ color: new Color(color), shininess, specular: 0x404040 });
}

/** (y, z) sırası — ilk versiyonda (z, y) idi ve 3. seviyenin gözleri kürenin içine gömülüyordu. */
function eyes(g: Group, r: number, y: number, z: number): void {
  const white = new MeshPhongMaterial({ color: 0xffffff, shininess: 60 });
  const black = new MeshBasicMaterial({ color: 0x181330 });
  for (const dir of [-1, 1]) {
    const e = new Mesh(new SphereGeometry(r * 0.19, 14, 10), white);
    e.position.set(dir * r * 0.3, y, z);
    e.scale.set(1, 1.15, 0.7);
    g.add(e);
    const p = new Mesh(new SphereGeometry(r * 0.095, 10, 8), black);
    p.position.set(dir * r * 0.32, y, z + r * 0.11);
    g.add(p);
  }
}

/**
 * Kanat. Aynalama `scale.x = -1` ile yapılıyor ve BİLEREK öyle bırakıldı.
 *
 * Aynalamayı geometriye taşımayı denedim (shape koordinatlarını dir ile
 * çarpmak): asset tarafındaki kayıp kanadı düzeltmedi, üstüne çalışan
 * prosedürel tarafı da bozdu — çünkü rotation.y = dir * 0.5 aynalanmış
 * çerçevede ters yöne dönüyor ve sol kanat gövdenin arkasına giriyor.
 * Gerçek sebep sarım yönü; çözüm models.ts'te yükleme sırasında
 * malzemeleri DoubleSide'a çekmek.
 */
function wingMesh(r: number, color: number): Mesh {
  const s = new Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(r * 1.1, r * 0.95, r * 1.35, r * 0.05);
  s.quadraticCurveTo(r * 0.95, r * 0.05, r * 1.0, -r * 0.45);
  s.quadraticCurveTo(r * 0.55, -r * 0.2, 0, -r * 0.35);
  const m = new Mesh(new ShapeGeometry(s), new MeshPhongMaterial({ color, side: DoubleSide, shininess: 10 }));
  return m;
}

function horns(g: Group, r: number, y: number): void {
  const m = mat(0xfbe6c0, 40);
  for (const dir of [-1, 1]) {
    const h = new Mesh(new ConeGeometry(r * 0.17, r * 0.55, 10), m);
    h.position.set(dir * r * 0.42, y, -r * 0.05);
    h.rotation.z = dir * -0.5;
    h.rotation.x = -0.25;
    g.add(h);
  }
}

/** Seviye başına prosedürel 3D karakter. Tek bir GLB yok — hepsi primitif. */
export function creature(level: number, cell: number): Group {
  const g = new Group();
  const r = cell * 0.36;
  const sk = SKINS[Math.min(level, SKINS.length) - 1];

  // zemin gölgesi (ucuz blob shadow — gerçek shadow map yerine)
  const sh = new Mesh(
    new CircleGeometry(r * 0.75, 20),
    new MeshBasicMaterial({ color: 0x000000, opacity: 0.28, transparent: true })
  );
  sh.position.set(0, -r * 1.05, -cell * 0.24);
  g.add(sh);

  if (level >= 4) {
    // İlk versiyonda kanatlar z=-0.35r'deydi ve gövdenin arkasında kayboluyordu.
    // Dışarı taşırıp hafif öne alınca silüet okunuyor.
    for (const dir of [-1, 1]) {
      const w = wingMesh(r * (level === 5 ? 1.25 : 0.95), sk.dark);
      w.position.set(dir * r * 0.72, r * 0.18, -r * 0.1);
      w.scale.x = dir;
      w.rotation.y = dir * 0.5;
      w.rotation.z = dir * 0.15;
      g.add(w);
    }
  }

  const body = new Mesh(new SphereGeometry(r, 26, 20), mat(sk.body));
  if (level === 1 || level === 2) body.scale.set(0.84, 1.06, 0.84);
  else body.scale.set(0.92, 1, 0.92);
  g.add(body);

  if (level === 2) {
    // kabuk kapağı: küre diliminden, hafif kaydırılmış
    const cap = new Mesh(new SphereGeometry(r * 1.02, 22, 10, 0, Math.PI * 2, 0, 0.85), mat(sk.accent, 12));
    cap.position.y = r * 0.16;
    cap.rotation.z = 0.24;
    g.add(cap);
    eyes(g, r, r * 0.05, r * 0.86);
  } else if (level === 3) {
    const cap = new Mesh(new SphereGeometry(r * 1.0, 20, 9, 0, Math.PI * 2, 0, 0.7), mat(0xfff4dd, 12));
    cap.position.y = r * 0.5;
    cap.rotation.z = -0.34;
    g.add(cap);
    const beak = new Mesh(new ConeGeometry(r * 0.2, r * 0.38, 8), mat(0xf0a63c, 30));
    beak.position.set(0, -r * 0.16, r * 0.88);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
    eyes(g, r, r * 0.16, r * 0.86);
  } else if (level === 4) {
    horns(g, r, r * 0.85);
    eyes(g, r, r * 0.14, r * 0.88);
  } else if (level === 5) {
    body.scale.set(0.86, 0.9, 0.86);
    body.position.y = -r * 0.28;
    const head = new Mesh(new SphereGeometry(r * 0.78, 24, 18), mat(sk.body));
    head.position.y = r * 0.58;
    head.scale.set(1, 0.92, 1);
    g.add(head);
    const snout = new Mesh(new SphereGeometry(r * 0.34, 16, 12), mat(sk.body));
    snout.position.set(0, r * 0.42, r * 0.62);
    snout.scale.set(1, 0.72, 1.1);
    g.add(snout);
    horns(g, r * 1.15, r * 1.12);
    eyes(g, r, r * 0.62, r * 0.72);
    const glow = new PointLight(0xff9a3c, 1.4, r * 7, 2);
    glow.position.set(0, 0, r * 1.2);
    g.add(glow);
  } else {
    // level 1: sade yumurta, benekler
    for (const [dx, dy] of [[-0.35, 0.2], [0.3, -0.05], [0.05, 0.45]] as Array<[number, number]>) {
      const s = new Mesh(new SphereGeometry(r * 0.13, 10, 8), mat(sk.dark, 8));
      s.position.set(dx * r, dy * r, r * 0.78);
      s.scale.z = 0.35;
      g.add(s);
    }
  }

  if (level === 1) g.userData.spin = true;
  return g;
}


