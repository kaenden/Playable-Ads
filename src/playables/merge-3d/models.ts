/**
 * GLB'den model yükleme — 3D tarafın "asset hattı" ucu.
 *
 * `__ART__ === 'atlas'` iken build, optimize edilmiş creatures.opt.glb'yi
 * base64 olarak gömüyor ve burada GLTFLoader.parse ile ArrayBuffer'dan
 * okunuyor. Network isteği yok, dosya yok.
 *
 * Model KHR_mesh_quantization ile sıkıştırılmış; GLTFLoader bunu yerleşik
 * destekliyor, ek decoder gerekmiyor — Draco'yu elemiş olmamızın karşılığı bu.
 *
 * Bu dosya creatures.ts'ten AYRI: creatures.ts Node'da da çalışmak zorunda
 * (GLB dışa aktarımı onu bundle'lıyor), GLTFLoader ise tarayıcıya bağlı.
 */
import { Object3D, Mesh, Material, DoubleSide } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** export-creatures.mjs ile aynı isimler ve aynı referans hücre ölçüsü. */
const NAMES = ['Level1_Egg', 'Level2_Cracked', 'Level3_Hatchling', 'Level4_Wyrmling', 'Level5_Dragon'];
const REF_CELL = 100;

let nodes: Record<string, Object3D> = {};

function toBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function loadModels(): Promise<void> {
  if (__ART__ !== 'atlas' || !__GLB_B64__) return Promise.resolve();
  return new Promise<void>((res) => {
    try {
      new GLTFLoader().parse(
        toBuffer(__GLB_B64__),
        '',
        (gltf) => {
          gltf.scene.traverse((o) => {
            if (o.name && NAMES.indexOf(o.name) >= 0) nodes[o.name] = o;
            // Aynalanmış parçalar (negatif ölçekli kanatlar) glTF round-trip'inde
            // ters sarımla geliyor ve backface-cull'a takılıp KAYBOLUYOR.
            // three'nin renderer'ı prosedürel sahnede negatif determinantı görüp
            // cull yönünü çeviriyor, yüklenen modelde bu bilgi yok.
            const m = o as Mesh;
            if (m.isMesh && m.material) {
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              for (const mat of mats) (mat as Material).side = DoubleSide;
            }
          });
          res();
        },
        // GLB açılmazsa oyun kilitlenmesin: prosedürel geometriye düşülüyor.
        () => res()
      );
    } catch (e) {
      res();
    }
  });
}

/** Yüklü modelin kopyası; yoksa null döner ve çağıran prosedürele düşer. */
export function modelFor(level: number, cell: number): Object3D | null {
  const src = nodes[NAMES[Math.min(level, NAMES.length) - 1]];
  if (!src) return null;
  const g = src.clone(true);
  // Dışa aktarımda yan yana dizilmişlerdi; sahnede merkeze oturmalı.
  g.position.set(0, 0, 0);
  g.rotation.set(0, 0, 0);
  g.scale.setScalar(cell / REF_CELL);
  return g;
}
