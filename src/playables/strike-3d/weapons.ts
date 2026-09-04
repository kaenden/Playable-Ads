/**
 * SİLAHLAR — tek tarif, iki çizici.
 *
 * Önceki sürümde fırlatılan şey ince sarı bir kutuydu ve "silah" olarak
 * okunmuyordu; ekranda sadece uçan bir çizgi vardı. Asıl sorun buydu: oyunun
 * iki sayacından biri SİLAH GÜCÜ, ama silahın kendisi görünmüyordu, sadece
 * sayısı vardı.
 *
 * Çözüm dört kademe: hançer, balta, pala, çift ağızlı balta — hepsi korsan
 * temasına oturan takım. Her yükseltmede havada uçan cisim DEĞİŞİYOR ve
 * büyüyor, yani "silahım güçlendi" bilgisi sayıyı okumadan da geliyor.
 *
 * BOYLAR SONRADAN BÜYÜTÜLDÜ. İlk kademe 0.58 birimdi ve karakterin elinde
 * neredeyse görünmüyordu: uzaktan bakan biri için oyun "silahsız başlıyor"
 * gibi okunuyordu, oysa oyunun bütün mantığı elindeki silahın değişmesi.
 * Alt uç yukarı çekildi, üst uç ise kalabalıkta çelik duvarına dönmesin
 * diye ölçülü bırakıldı.
 *
 * MODEL YOK, TARİF VAR. Her silah birkaç kutunun listesi. Bu listeden hem
 * three.js geometrisi hem 2D ikon üretiliyor: kartta gördüğün şekil ile
 * havada uçan şekil aynı tarifin iki çizimi, ayrı ayrı elle çizilmiş iki
 * varlık değil. Projenin baştan beri yaptığı şeyin aynısı — aynı durum, iki
 * görünüm — silah düzeyinde.
 *
 * MALİYET. Kademe başına tek InstancedMesh: aynı anda havada yirmi silah da
 * olsa çizim çağrısı sayısı kademe sayısı kadar, ve sadece havada örneği
 * olan kademe çiziliyor. Pakete eklediği bayt: sıfır, hepsi kod.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';

const STEEL = '#DCE6F2';
const STEEL_DARK = '#94A9C2';
const EDGE = '#F7FBFF';
const GOLD = '#E8B93B';
const WOOD = '#7A5230';
const WOOD_DARK = '#4A3220';
const LEATHER = '#3E2E22';

/** Silahın bir parçası: eksene hizalı kutu, isteğe bağlı Z dönüşüyle. */
interface Part {
  w: number;
  h: number;
  d: number;
  x?: number;
  y?: number;
  /** Z ekseni dönüşü (radyan). Uç sivriltmek için 45 derece kullanılıyor. */
  rot?: number;
  color: string;
}

export interface WeaponDef {
  /** Bu silahın verdiği hasar. Parkurdaki `gives` değerleriyle eşleşiyor. */
  dmg: number;
  name: string;
  /** Dünya birimiyle toplam boy. Karakter 1.15 — yükseltme gözle büyüyor. */
  len: number;
  parts: Part[];
  /** Parçalardan hesaplanan yarı yükseklik; ölçekleme buradan çıkıyor. */
  half: number;
}

/**
 * Parçalar arkadan öne sıralı: 2D ikonda derinlik yok, sıra üst üste binmeyi
 * belirliyor. 3D'de sıra fark etmiyor, ikonda ediyor — tek liste ikisine de
 * hizmet ettiği için sıra ikona göre kuruldu.
 */
const DEFS: Array<Omit<WeaponDef, 'half'>> = [
  {
    dmg: 2,
    name: 'DAGGER',
    len: 0.74,
    parts: [
      { w: 0.16, h: 0.3, d: 0.13, y: -0.3, color: WOOD_DARK },
      { w: 0.34, h: 0.08, d: 0.16, y: -0.12, color: GOLD },
      { w: 0.18, h: 0.52, d: 0.07, y: 0.2, color: STEEL },
      { w: 0.13, h: 0.13, d: 0.07, y: 0.47, rot: Math.PI / 4, color: STEEL },
      { w: 0.06, h: 0.46, d: 0.08, x: 0.06, y: 0.2, color: EDGE },
    ],
  },
  {
    dmg: 3,
    name: 'HATCHET',
    len: 0.88,
    parts: [
      { w: 0.12, h: 1.0, d: 0.12, y: -0.05, color: WOOD },
      { w: 0.17, h: 0.09, d: 0.17, y: -0.57, color: GOLD },
      { w: 0.4, h: 0.3, d: 0.1, x: 0.22, y: 0.3, color: STEEL },
      { w: 0.22, h: 0.16, d: 0.1, x: 0.17, y: 0.09, color: STEEL },
      { w: 0.07, h: 0.4, d: 0.11, x: 0.4, y: 0.28, color: EDGE },
      { w: 0.19, h: 0.13, d: 0.15, y: 0.34, color: STEEL_DARK },
    ],
  },
  {
    dmg: 5,
    name: 'CUTLASS',
    len: 1.02,
    parts: [
      { w: 0.12, h: 0.26, d: 0.12, y: -0.4, color: LEATHER },
      { w: 0.19, h: 0.14, d: 0.17, y: -0.58, color: GOLD },
      { w: 0.22, h: 0.92, d: 0.07, y: 0.28, color: STEEL },
      { w: 0.16, h: 0.16, d: 0.07, y: 0.78, rot: Math.PI / 4, color: STEEL },
      { w: 0.07, h: 0.82, d: 0.085, y: 0.28, color: STEEL_DARK },
      { w: 0.56, h: 0.1, d: 0.14, y: -0.22, color: GOLD },
    ],
  },
  {
    dmg: 9,
    name: 'GREAT AXE',
    len: 1.2,
    parts: [
      // Sap KOYU DEĞİL. İlk denemede koyu ahşaptı ve silah kartının koyu
      // zemininde sadece iki çelik ağız görünüyordu — silahın gövdesi yoktu.
      { w: 0.13, h: 1.05, d: 0.13, y: -0.06, color: WOOD },
      { w: 0.18, h: 0.11, d: 0.18, y: -0.61, color: GOLD },
      { w: 0.38, h: 0.4, d: 0.11, x: -0.23, y: 0.34, color: STEEL },
      { w: 0.38, h: 0.4, d: 0.11, x: 0.23, y: 0.34, color: STEEL },
      { w: 0.08, h: 0.5, d: 0.12, x: -0.42, y: 0.32, color: EDGE },
      { w: 0.08, h: 0.5, d: 0.12, x: 0.42, y: 0.32, color: EDGE },
      { w: 0.21, h: 0.5, d: 0.16, y: 0.3, color: STEEL_DARK },
      { w: 0.11, h: 0.19, d: 0.11, y: 0.63, rot: Math.PI / 4, color: GOLD },
    ],
  },
];

/** Dönmüş parçanın kapladığı yarı yükseklik — köşegen, kenar değil. */
function partHalf(p: Part): number {
  const h = p.rot ? Math.abs(p.w * Math.sin(p.rot)) + Math.abs(p.h * Math.cos(p.rot)) : p.h;
  return Math.abs(p.y ?? 0) + h / 2;
}

export const WEAPONS: WeaponDef[] = DEFS.map((d) => ({
  ...d,
  half: d.parts.reduce((m, p) => Math.max(m, partHalf(p)), 0.001),
}));

/**
 * Hasar değerinden kademe. Parkurdaki her `gives` bir kademeye denk düşüyor;
 * arada bir değer çıkarsa en yakın alt kademe kullanılıyor, yani parkur
 * değişse de görünüm bozulmuyor.
 */
export function weaponTier(dmg: number): number {
  let t = 0;
  for (let i = 0; i < WEAPONS.length; i++) if (dmg >= WEAPONS[i].dmg) t = i;
  return t;
}

export function weaponName(dmg: number): string {
  return WEAPONS[weaponTier(dmg)].name;
}

/** 2D ikon — kartta ve yükseltme hedefinin üstünde aynı şekil. */
export function weaponIcon(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  tier: number
): void {
  const w = WEAPONS[Math.max(0, Math.min(WEAPONS.length - 1, tier))];
  const k = r / w.half;
  g.save();
  g.translate(cx, cy);
  // Y ekseni yukarı: tarif dünya koordinatında yazıldı, canvas'ta ters.
  g.scale(k, -k);
  for (const p of w.parts) {
    g.save();
    g.translate(p.x ?? 0, p.y ?? 0);
    if (p.rot) g.rotate(p.rot);
    g.fillStyle = p.color;
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    g.restore();
  }
  g.restore();
}

/** Küpün altı yüzü, yüz başına dört köşe — her yüz kendi normalini taşıyor. */
const CUBE_POS = [
  [1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, -1],
  [-1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1],
  [-1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1],
  [-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1],
  [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1],
  [1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1],
];
const CUBE_NOR = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Kademenin geometrisi — bütün parçalar TEK BufferGeometry'de birleşik,
 * renk köşe niteliğinde taşınıyor.
 *
 * Parça başına ayrı mesh de olurdu ama o zaman instancing kırılırdı: havadaki
 * her silah için altı çizim çağrısı çıkardı. Köşe rengi, tek malzemeyle çok
 * renkli bir cisim vermenin karşılığı ve instancing'i bozmuyor.
 *
 * Uzun ekseni Y: silah ekranda dikey duruyor ve Z ekseninde takla atıyor.
 * Kamera arkadan baktığı için bu, silüetin her karede tam okunduğu tek dönüş
 * ekseni — Y ekseninde döndürüldüğünde yarı zaman kenardan görünüp
 * kayboluyordu.
 */
export function weaponGeometry(tier: number): BufferGeometry {
  const w = WEAPONS[Math.max(0, Math.min(WEAPONS.length - 1, tier))];
  const k = w.len / 2 / w.half;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const p of w.parts) {
    const hw = p.w / 2;
    const hh = p.h / 2;
    const hd = p.d / 2;
    const px = p.x ?? 0;
    const py = p.y ?? 0;
    const c = Math.cos(p.rot ?? 0);
    const s = Math.sin(p.rot ?? 0);
    const cr = parseInt(p.color.slice(1, 3), 16) / 255;
    const cg = parseInt(p.color.slice(3, 5), 16) / 255;
    const cb = parseInt(p.color.slice(5, 7), 16) / 255;
    for (let f = 0; f < 6; f++) {
      const base = pos.length / 3;
      const v = CUBE_POS[f];
      const n = CUBE_NOR[f];
      for (let i = 0; i < 4; i++) {
        const x = v[i * 3] * hw;
        const y = v[i * 3 + 1] * hh;
        const z = v[i * 3 + 2] * hd;
        pos.push((px + x * c - y * s) * k, (py + x * s + y * c) * k, z * k);
        nor.push(n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]);
        col.push(cr, cg, cb);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
