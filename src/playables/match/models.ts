/**
 * Model yükleme — 3D sürümün taşları.
 *
 * Kaynak 2D sürümün sprite'larıyla AYNI: Kenney Food Kit, CC0. 5 model,
 * geldiği hâli 92.3 KB, hattan çıkan tek GLB 31.5 KB.
 *
 * Modeller kendi ölçülerinde (muz uzun ve ince, burger kübik). Izgarada
 * hepsinin görsel ağırlığı benzer olmalı, yoksa oyuncu "hangi taş hangisi"
 * sorusunu boyuttan değil renkten çözmek zorunda kalıyor. Bu yüzden her
 * model kendi sınır kutusuna göre normalize ediliyor — 2D sprite'ları
 * render ederken yaptığımız kadraj hesabının aynısı.
 */
import { Box3, Group, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPalette, fixPaletteTextures, loadPalette } from '../../core/palette';

interface Entry {
  node: Object3D;
  /** Birim küpe sığdıran ölçek. */
  fit: number;
  /** Merkeze taşıyan ofset. */
  off: Vector3;
}

const models: Record<string, Entry> = {};

function toBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function loadModels(): Promise<void> {
  if (!__GLB_B64__) return Promise.resolve();
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
          const center = new Vector3();
          for (const child of gltf.scene.children.slice()) {
            // Birleştirme adımı çakışan isimlere `_1` ekliyor; oyunun
            // kullandığı ad son eksiz olan.
            const name = child.name.replace(/_\d+$/, '');
            if (!name) continue;
            box.setFromObject(child);
            box.getSize(size);
            box.getCenter(center);
            const max = Math.max(size.x, size.y, size.z) || 1;
            models[name] = { node: child, fit: 1 / max, off: center.clone().multiplyScalar(-1) };
          }
          // Palet yüklenmeden ilk kare çizilirse modeller bir an renksiz
          // görünüyor; hazır olduğunda bağlanıp öyle başlanıyor.
          loadPalette().then((tex) => {
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
  return Object.keys(models).length > 0;
}

/** Birim küpe normalize edilmiş, merkezi orijinde bir kopya. */
export function pieceFor(name: string): Group | null {
  const e = models[name];
  if (!e) return null;
  const g = new Group();
  const inner = e.node.clone(true);
  inner.position.copy(e.off);
  const holder = new Group();
  holder.add(inner);
  holder.scale.setScalar(e.fit);
  g.add(holder);
  return g;
}
