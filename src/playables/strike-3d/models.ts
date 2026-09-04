/**
 * Sahnenin bütün malzemesi tek dosyadan geliyor.
 *
 * `isle.glb` = 16 model tek GLB'de (123.4 KB): 1 animasyonlu karakter
 * (Kenney "Blocky Characters" — göz bantlı olanı) + 15 ada parçası (Kenney
 * "Nature Kit": palmiye, kaya, oberlisk, küp, kano, kütük). İkisi de CC0.
 * Yanında 4.8 KB'lık karakter dokusu ayrı taşınıyor.
 *
 * KARDEŞ BİRİM AYNI KİTTEN BAŞKA MODELLER ÇEKİYOR. Crowd Rush'ın `run.glb`i
 * çam ve çiçek taşıyor, bu palmiye ve harabe. Paket ortak, SEÇİM ayrı —
 * gerçek işte de bir stüdyodan gelen kit tek, ondan çıkarılan kreatif çok.
 *
 * İKİ AYRI MALZEME DÜNYASI aynı sahnede:
 *
 *  - Karakter UNLIT geliyor (KHR_materials_unlit). Işık almıyor, ekranda hep
 *    aynı parlaklıkta. Kalabalık için tam istediğimiz şey: 20 kişi üst üste
 *    binince gölge karmaşası olmuyor, siluet net kalıyor.
 *  - Doğa parçaları PBR geliyor ve pakette `metalness = 1` yazıyor. Ortam
 *    haritası olmayan bir sahnede bu, ağaçları SİMSİYAH yapıyor — çünkü
 *    metalik yüzeyin rengi yansımadan gelir, yansıtacak bir şey yoksa
 *    siyahtır. Yükleme anında hepsi Lambert'e çevriliyor: hem doğru
 *    görünüyor hem de PBR shader'ının maliyeti gidiyor. 20 saniyelik bir
 *    reklamda kimse metalik yansıma aramıyor.
 */
import {
  AnimationClip,
  Box3,
  Color,
  Group,
  Material,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPalette, loadPalette } from '../../core/palette';

interface Entry {
  node: Object3D;
  size: Vector3;
}

const models: Record<string, Entry> = {};
const clips: Record<string, AnimationClip> = {};

function toBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

interface MaybeColored extends Material {
  color?: Color;
  map?: unknown;
}

/**
 * PBR malzemeleri Lambert'e indir. Dokulu (işaretli) malzemeye dokunma —
 * o karakterin unlit malzemesi, palet oraya bağlanacak.
 */
function toLambert(root: Object3D): void {
  const cache: Record<string, MeshLambertMaterial> = {};
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
    const src = m.material as MaybeColored;
    // MeshBasicMaterial = unlit karakter. Adında `palette:` işareti var.
    if ((src.name || '').indexOf('palette:') === 0) return;
    const key = src.uuid;
    if (!cache[key]) {
      const lam = new MeshLambertMaterial({ color: src.color ? src.color.clone() : new Color(0xffffff) });
      lam.name = src.name;
      cache[key] = lam;
    }
    m.material = cache[key];
  });
}

export function loadModels(): Promise<void> {
  if (!__GLB_B64__) return Promise.resolve();
  return new Promise<void>((res) => {
    try {
      new GLTFLoader().parse(
        toBuffer(__GLB_B64__),
        '',
        (gltf) => {
          toLambert(gltf.scene);
          const box = new Box3();
          for (const child of gltf.scene.children.slice()) {
            // Birleştirme adımı her modeli kendi adıyla bir düğümün altına
            // koyuyor; iç ve dış düğüm aynı adı taşıyınca GLTFLoader ikincisine
            // `_1` ekliyor. Oyunun aradığı ad son eksiz olan.
            const name = child.name.replace(/_\d+$/, '');
            if (!name) continue;
            box.setFromObject(child);
            const size = new Vector3();
            box.getSize(size);
            models[name] = { node: child, size };
          }
          for (const c of gltf.animations) clips[c.name] = c;
          // Doku GLB'nin dışında geliyor (sebebi core/palette.ts'te).
          // Karakter dokusu gerçek bir yüzey haritası, kartela değil:
          // mipmap AÇIK, yoksa kalabalık uzaklaştıkça titriyor.
          loadPalette(true).then((tex) => {
            applyPalette(gltf.scene, tex);
            res();
          });
        },
        () => res()
      );
    } catch (e) {
      res();
    }
  });
}

export function ready(): boolean {
  return !!models['character-p'];
}

export function clipNamed(name: string): AnimationClip | null {
  return clips[name] || null;
}

/**
 * Karakter kopyası, boyu `h` olacak şekilde ölçeklenmiş.
 *
 * Ölçek DIŞ gruba veriliyor: animasyon iç düğümlerin yerel dönüşümlerini
 * yazıyor, oraya ölçek koymak animasyonun ilk karesinde siliniyordu.
 */
export function charClone(h: number): Group | null {
  const e = models['character-p'];
  if (!e) return null;
  const g = new Group();
  const inner = e.node.clone(true);
  inner.position.set(0, 0, 0);
  g.add(inner);
  g.scale.setScalar(h / (e.size.y || 1));
  return g;
}

/** Doğa parçası kopyası. `h` verilirse o boya ölçekleniyor. */
export function propClone(name: string, h?: number): Group | null {
  const e = models[name];
  if (!e) return null;
  const g = new Group();
  const inner = e.node.clone(true);
  inner.position.set(0, 0, 0);
  g.add(inner);
  if (h) g.scale.setScalar(h / (e.size.y || 1));
  return g;
}

export function propSize(name: string): Vector3 | null {
  const e = models[name];
  return e ? e.size : null;
}
