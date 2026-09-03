/**
 * Müşteri modellerini yükler — bu birimin ASSET yolu.
 *
 * `__ART__ === 'atlas'` iken build, optimize edilmiş `cars.glb`'yi base64
 * olarak gömüyor ve burada GLTFLoader.parse ile ArrayBuffer'dan okunuyor.
 * Ağ isteği yok, dosya yok.
 *
 * Kaynak: Kenney "Car Kit", CC0. Gelen hâli 7 model / 1271 KB; hat onu tek
 * bir 212 KB'lık GLB'ye indiriyor (dedup + weld + 256px WebP + quantize +
 * birleştirme). Model KHR_mesh_quantization ile sıkıştırılmış; GLTFLoader
 * bunu yerleşik destekliyor, ek decoder gerekmiyor.
 *
 * İKİ HİZALAMA İŞİ var ve ikisi de gerçek asset devrinin standart bedeli:
 *
 *  1. YÖN. Kenney araçları uzunluk ekseni Z'de duruyor; bizim simülasyonumuz
 *     aracı +X'e bakar kabul ediyor. Modelleri yeniden dışa aktarmak yerine
 *     yükleme anında bir kez döndürülüyorlar.
 *  2. ÖLÇEK. Modeller kendi birimlerinde (sedan 2.55 uzun, 1.50 geniş);
 *     oyunun hücresi 1 birim. Her model kendi ölçüsüne göre hücreye
 *     oturtuluyor — sabit bir çarpan yanlış olurdu, çünkü paketteki
 *     araçların boyu 2.55 ile 3.10 arasında değişiyor.
 */
import { Box3, Group, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPalette, fixPaletteTextures, loadPalette } from '../../core/palette';

/** Oyun içi araç id'si -> pakete ait model adı. */
const FOR_ID: Record<number, string> = {
  1: 'sedan-sports',
  2: 'taxi',
  3: 'sedan',
  4: 'suv',
  5: 'van',
  6: 'hatchback-sports',
  7: 'police',
};

interface Entry {
  node: Object3D;
  len: number;
  wid: number;
}

const models: Record<string, Entry> = {};

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
          // Palet GLB'nin dışında geliyor (sebebi core/palette.ts'te).
          fixPaletteTextures(gltf.scene);
          const box = new Box3();
          const size = new Vector3();
          for (const child of gltf.scene.children.slice()) {
            const name = child.name;
            if (!name) continue;
            box.setFromObject(child);
            box.getSize(size);
            models[name] = { node: child, len: size.z, wid: size.x };
          }
          // Palet yüklenmeden ilk kare çizilirse modeller bir an renksiz
          // görünüyor; hazır olduğunda bağlanıp öyle başlanıyor.
          loadPalette().then((tex) => {
            applyPalette(gltf.scene, tex);
            res();
          });
        },
        // GLB açılmazsa oyun kilitlenmesin: prosedürel geometriye düşülüyor.
        () => res()
      );
    } catch (e) {
      res();
    }
  });
}

/**
 * Araç id'si ve hücre uzunluğu için hazır bir model kopyası.
 * Sahnenin dünya birimi = 1 hücre, o yüzden ek ölçek yok.
 * Model yoksa null döner ve çağıran prosedürel geometriye düşer.
 */
export function modelFor(id: number, len: number): Group | null {
  const e = models[FOR_ID[id]];
  if (!e) return null;

  // Boy hücreye, en de şeride sığmalı; kısıtlayıcı olan hangisiyse o belirliyor.
  const k = Math.min((len * 0.98) / e.len, 1.0 / e.wid);

  const g = new Group();
  const inner = e.node.clone(true);
  // Paketin araçları Z ekseninde uzuyor, simülasyon +X bekliyor.
  inner.rotation.y = Math.PI / 2;
  inner.scale.setScalar(k);
  inner.position.set(0, 0, 0);
  g.add(inner);
  return g;
}
