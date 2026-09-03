/**
 * Model -> sprite render'ı. Tarayıcıda çalışır, build/render-sprites.mjs
 * tarafından tek dosyalık bir sayfaya paketlenir.
 *
 * Neden var: müşteri 3D model gönderiyor ama 2D birimin sprite'a ihtiyacı var.
 * Paketin kendi `Previews/` klasöründeki PNG'ler 64px thumbnail — yerleştirme
 * için yeterli, üretim için değil. Doğru cevap sprite'ı modelden KENDİN
 * render etmek: aynı sanat, istediğin çözünürlükte, istediğin ışıkla.
 *
 * Sektörde standart iş akışı bu (match-3'lerin çoğunun 2D art'ı aslında
 * pre-render edilmiş 3D'dir). Bir kerelik sanat adımı olduğu için build'in
 * içinde değil, çıktısı hattın GİRDİSİ olarak saklanıyor.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 256;

function toBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** 3D birimdeki ışık kurulumunun aynısı: iki çıktı aynı sanata benzemeli. */
function light(scene) {
  scene.add(new AmbientLight(0xdce8ff, 0.75));
  const key = new DirectionalLight(0xfff6e8, 1.5);
  key.position.set(-2.2, 3.4, 2.6);
  scene.add(key);
  const fill = new DirectionalLight(0x9ec4ff, 0.5);
  fill.position.set(2.6, 1.2, -2.0);
  scene.add(fill);
}

new GLTFLoader().parse(
  toBuffer(__GLB_B64__),
  '',
  (gltf) => {
    const out = {};
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);

    const list = gltf.scene.children.slice();
    for (const node of list) {
      const name = node.name;
      if (!name) continue;

      const scene = new Scene();
      light(scene);
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0);
      scene.add(node);

      const box = new Box3().setFromObject(node);
      const c = box.getCenter(new Vector3());

      // Hafif 3/4 açı: düz önden bakmak modelleri düz kart gibi gösteriyordu.
      const dir = new Vector3(0.42, 0.5, 1).normalize();
      const cam = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      cam.position.copy(c).addScaledVector(dir, 10);
      cam.lookAt(c);
      cam.updateMatrixWorld(true);

      // Kadraj sınır kutusunun EN BÜYÜK KENARINDAN değil, kameradaki gerçek
      // İZDÜŞÜMÜNDEN hesaplanıyor. İlk sürüm max(x,y,z) kullanıyordu ve
      // muz gibi tek eksende uzun modeller kadrajın yarısında kalıyordu:
      // eğik bakışta uzun kenarın ekrandaki karşılığı kendisinden kısa.
      const inv = cam.matrixWorldInverse;
      const v = new Vector3();
      let ext = 0;
      for (let i = 0; i < 8; i++) {
        v.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        ).applyMatrix4(inv);
        ext = Math.max(ext, Math.abs(v.x), Math.abs(v.y));
      }
      const radius = ext * 1.08; // %8 pay: kenarlar kırpılmasın
      cam.left = -radius;
      cam.right = radius;
      cam.top = radius;
      cam.bottom = -radius;
      cam.updateProjectionMatrix();

      renderer.setClearAlpha(0);
      renderer.render(scene, cam);
      out[name] = renderer.domElement.toDataURL('image/png');
      scene.remove(node);
    }

    window.__sprites = out;
    document.title = 'HAZIR ' + Object.keys(out).length;
    const el = document.getElementById('log');
    if (el) el.textContent = Object.keys(out).length + ' sprite hazır: ' + Object.keys(out).join(', ');
  },
  (err) => {
    window.__spriteError = String(err);
    const el = document.getElementById('log');
    if (el) el.textContent = 'HATA: ' + err;
  }
);
