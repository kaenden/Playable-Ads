/**
 * Three.js renderer — izometrik diorama.
 *
 * Merge'in 3D'sinden İKİ önemli farkı var:
 *
 * 1) ORTOGRAFİK kamera. Merge'de perspektif kamerayı z=0 düzlemi piksel
 *    birebir olacak şekilde kurmuştuk; orada sahne ekrana paraleldi. Burada
 *    sahne eğik, ve perspektifle eğik bir kutuyu verilen bir ekran
 *    dikdörtgenine tam oturtmak yinelemeli arama gerektiriyor. Ortografik
 *    izdüşüm doğrusal olduğu için aynı iş TEK adımda ve TAM çözülüyor —
 *    üstelik izometrik görünüm zaten istediğimiz oyuncak estetiği.
 *
 * 2) Girdi ışınla toplanıyor. Eğik sahnede aracın çatısı ayak izinden kaymış
 *    görünüyor; zemine ışın atıp hücre hesaplamak, oyuncunun GÖRDÜĞÜ yerden
 *    başka bir yeri seçerdi. Raycaster doğrudan araç mesh'lerine bakıyor.
 */
import {
  AmbientLight,
  Box3,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { LOT } from './config';
import { State, Car, step } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { Fx } from '../../core/fx';
import { buildCar, buildCone, buildTree, roundedBox, lotTexture } from './props';
import { modelFor } from './models';
import { EscapeView } from './view';

/** Kamera yönü — klasik 3/4 izometrik. */
const YAW = (38 * Math.PI) / 180;
const PITCH = (43 * Math.PI) / 180;
const DIR = new Vector3(
  Math.sin(YAW) * Math.cos(PITCH),
  Math.sin(PITCH),
  Math.cos(YAW) * Math.cos(PITCH)
).normalize();

/** Asfaltın üst yüzü. Araçlar bunun üstünde duruyor. */
const DECK = 0.1;
/** Çizgi düzlemi asfalttan bir tık yukarıda: aynı yükseklikte z-fighting oluyor. */
const PAINT_Y = 0.096;

interface Slot {
  car: Car;
  g: Group;
  mat: MeshPhongMaterial;
  /** Tıkalı dokunuş sarsıntısının geçen süresi; <0 ise sarsıntı yok. */
  bump: number;
  /** Engel olarak yanıp sönme süresi. */
  flash: number;
}

interface Leaving {
  car: Car;
  g: Group;
  t: number;
}

export class View3D implements EscapeView {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, -100, 200);
  private hudCtx: CanvasRenderingContext2D;
  private world = new Group();
  private slots: Record<number, Slot> = {};
  private leaving: Leaving[] = [];
  private clouds: Group[] = [];
  private ray = new Raycaster();
  private bounds = new Box3();
  private t = 0;
  private wonAt = -1;
  /** fitCamera'nın bulduğu piksel / dünya birimi oranı. */
  private pxPerUnit = 1;

  constructor(gl: HTMLCanvasElement) {
    gl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    const hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(hud);
    this.cv = hud;
    this.hudCtx = hud.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = '#BFE6FF';

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true });
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap three r185'te kaldırıldı — ayarlansa bile PCF'e düşüyor
    // ve konsola deprecation uyarısı basıyor. Sevk edilen bir kreatifte konsol
    // temiz olmalı; doğrudan gerçekte kullanılan tip yazılıyor.
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = skyTexture();
    this.scene.add(this.world);

    this.buildIsland();
    this.lights();

    this.hud = new Hud(this.hudCtx, this.L);
    this.resize();
  }

  // ------------------------------------------------------------------ sahne

  private lights(): void {
    this.scene.add(new AmbientLight(0xbcd6ff, 0.62));

    const key = new DirectionalLight(0xfff4e0, 1.45);
    key.position.set(LOT.cols * 0.5 - 5, 9, LOT.rows * 0.5 - 3.5);
    key.target.position.set(LOT.cols / 2, 0, LOT.rows / 2);
    key.castShadow = true;
    const s = Math.max(LOT.cols, LOT.rows) + 3;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 26;
    key.shadow.mapSize.set(1024, 1024);
    // Gölge akne'si (yüzeyin kendi kendine gölge yapması) yuvarlatılmış
    // kenarlarda çok belli oluyordu; bias onu kapatıyor.
    key.shadow.bias = -0.0012;
    this.scene.add(key);
    this.scene.add(key.target);

    // Dolgu: gölgelerin içi mürekkep gibi kalmasın, gökyüzü rengini alsın.
    const fill = new DirectionalLight(0x9ec4ff, 0.35);
    fill.position.set(LOT.cols + 6, 4, LOT.rows + 5);
    this.scene.add(fill);
  }

  private buildIsland(): void {
    const cx = LOT.cols / 2;
    const cz = LOT.rows / 2;

    // Çim taban
    const grass = new Mesh(
      roundedBox(LOT.cols + 2.3, LOT.rows + 2.3, 0.62, 0.6, 0.12),
      new MeshLambertMaterial({ color: 0x63c168 })
    );
    grass.position.set(cx, -0.62, cz);
    grass.receiveShadow = true;
    this.world.add(grass);

    // Toprak katman — adaya kalınlık veriyor
    const soil = new Mesh(
      roundedBox(LOT.cols + 2.0, LOT.rows + 2.0, 0.9, 0.55, 0.1),
      new MeshLambertMaterial({ color: 0x9a6b47 })
    );
    soil.position.set(cx, -1.5, cz);
    this.world.add(soil);

    // Asfalt
    const deck = new Mesh(
      roundedBox(LOT.cols + 0.5, LOT.rows + 0.5, 0.09, 0.28, 0.03),
      new MeshLambertMaterial({ color: 0x394051 })
    );
    deck.position.set(cx, 0, cz);
    deck.receiveShadow = true;
    this.world.add(deck);

    // Park yerleri: asfaltın üstüne ince bir düzlem. Izgara = oyunun kuralı.
    const paint = new Mesh(
      new PlaneGeometry(LOT.cols, LOT.rows),
      new MeshLambertMaterial({ map: lotTexture(LOT.cols, LOT.rows), transparent: false })
    );
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(cx, PAINT_Y, cz);
    paint.receiveShadow = true;
    this.world.add(paint);

    // Süs: koniler ve ağaçlar. Sabit konumlar — reklamda rastgelelik yok.
    const cones: Array<[number, number]> = [
      [-0.6, 0.7],
      [-0.6, LOT.rows - 0.7],
      [LOT.cols + 0.6, 1.5],
      [LOT.cols + 0.6, LOT.rows - 1.3],
      [1.3, LOT.rows + 0.6],
      [LOT.cols - 1.3, -0.6],
    ];
    for (const [x, z] of cones) {
      const c = buildCone();
      c.position.set(x, 0, z);
      this.world.add(c);
    }
    const trees: Array<[number, number, number]> = [
      [-0.95, -0.85, 1.0],
      [LOT.cols + 0.95, -0.9, 0.8],
      [-0.9, LOT.rows + 0.95, 0.88],
      [LOT.cols + 0.9, LOT.rows + 1.0, 1.05],
    ];
    for (const [x, z, s] of trees) {
      const t = buildTree(s);
      t.position.set(x, 0, z);
      this.world.add(t);
    }

    // Bulutlar — sahnedeki tek sürekli hareket. Araçlar park halinde durmalı,
    // yoksa "hangisi hareket edebilir" bilgisi bulanıyor.
    const cloudMat = new MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 3; i++) {
      const c = new Group();
      for (let j = 0; j < 3; j++) {
        const b = new Mesh(new SphereGeometry(0.34 + j * 0.09, 7, 5), cloudMat);
        b.position.set(j * 0.42 - 0.42, Math.sin(j) * 0.08, Math.cos(j * 2) * 0.12);
        c.add(b);
      }
      c.position.set(i * 3.4 - 2, 3.4 + i * 0.5, -2.6 + i * 2.4);
      c.scale.setScalar(0.9 + i * 0.2);
      this.clouds.push(c);
      this.world.add(c);
    }

    // Kamera bu kutuyu ekrandaki `board` dikdörtgenine oturtacak.
    // Bulutlar KASITLI olarak kutunun dışında: onları da sığdırmak sahneyi
    // gereksiz küçültürdü. Kadraja girip çıkmaları serbest.
    this.bounds.set(
      new Vector3(-1.35, -2.1, -1.35),
      new Vector3(LOT.cols + 1.35, 1.5, LOT.rows + 1.35)
    );
  }

  // ----------------------------------------------------------------- kamera

  resize(): void {
    this.L.update();
    const { w, h, dpr } = this.L;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);

    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.fitCamera();
  }

  /**
   * Sahneyi TAM olarak L.board dikdörtgenine oturtur.
   *
   * Ortografik izdüşüm doğrusal: dünya birimi -> piksel oranı (s) sahnenin her
   * yerinde aynı. O yüzden frustum'u tersten kurabiliyoruz — "şu dünya noktası
   * şu pikselde dursun" denklemi doğrudan çözülüyor, deneme yanılma yok.
   */
  private fitCamera(): void {
    const L = this.L;
    const cam = this.camera;
    const c = this.bounds.getCenter(new Vector3());

    cam.position.copy(c).addScaledVector(DIR, 40);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld(true);

    // Kutunun 8 köşesi kamera uzayında
    const inv = cam.matrixWorldInverse;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const v = new Vector3();
    for (let i = 0; i < 8; i++) {
      v.set(
        i & 1 ? this.bounds.max.x : this.bounds.min.x,
        i & 2 ? this.bounds.max.y : this.bounds.min.y,
        i & 4 ? this.bounds.max.z : this.bounds.min.z
      ).applyMatrix4(inv);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }

    const bw = maxX - minX;
    const bh = maxY - minY;
    const m = Math.min(L.board.w, L.board.h) * 0.02;
    // px / dünya birimi — iki eksenden kısıtlayıcı olanı
    const s = Math.min((L.board.w - m * 2) / bw, (L.board.h - m * 2) / bh);

    // Kutu board içinde yatayda ortalı, dikeyde biraz YUKARIDA duruyor:
    // artan boşluk aşağıda toplanınca tutorial etiketi ile CTA'ya yer kalıyor.
    const tx = L.board.x + (L.board.w - bw * s) / 2;
    const ty = L.board.y + (L.board.h - bh * s) * 0.4;

    // screenX = (camX - left) * s  ve  screenY = (top - camY) * s
    cam.left = minX - tx / s;
    cam.right = cam.left + L.w / s;
    cam.top = maxY + ty / s;
    cam.bottom = cam.top - L.h / s;
    cam.updateProjectionMatrix();
    this.pxPerUnit = s;
    // HUD, etiketi adanın hemen altına koyabilsin diye gerçek yerleşimi bildir.
    L.scene = { x: tx, y: ty, w: bw * s, h: bh * s };
  }

  // ------------------------------------------------------------------ girdi

  /** Aracın dünya merkezi. */
  private worldOf(car: Car): Vector3 {
    return new Vector3(
      car.col + (car.horiz ? car.len / 2 : 0.5),
      DECK,
      car.row + (car.horiz ? 0.5 : car.len / 2)
    );
  }

  carScreenPos(car: Car): [number, number] | null {
    const v = this.worldOf(car);
    v.y += 0.42;
    v.project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.L.w, (-v.y * 0.5 + 0.5) * this.L.h];
  }

  /**
   * Işın doğrudan araç mesh'lerine atılıyor.
   * Zemine atıp hücre hesaplamak, eğik sahnede oyuncunun gördüğü araçtan
   * BAŞKA bir hücre seçerdi — araç yüksekliği kadar kayma var.
   */
  cellAt(x: number, y: number): number {
    const ndc = new Vector2((x / this.L.w) * 2 - 1, -(y / this.L.h) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const groups: Group[] = [];
    for (const k in this.slots) groups.push(this.slots[k].g);
    const hits = this.ray.intersectObjects(groups, true);
    if (!hits.length) return -1;
    let o = hits[0].object;
    while (o.parent && groups.indexOf(o as Group) < 0) o = o.parent;
    for (const k in this.slots) {
      if (this.slots[k].g === o) {
        const car = this.slots[k].car;
        return car.row * LOT.cols + car.col;
      }
    }
    return -1;
  }

  // -------------------------------------------------------------- animasyon

  drive(car: Car): void {
    const slot = this.slots[car.id];
    if (!slot) return;
    delete this.slots[car.id];
    this.leaving.push({ car, g: slot.g, t: 0 });
    const p = this.carScreenPos(car);
    if (p) this.fx.burst(p[0], p[1], Math.max(22, this.L.w * 0.05), 2, '#ffffff');
  }

  bump(car: Car, blocker: Car): void {
    const a = this.slots[car.id];
    if (a) a.bump = 0;
    const b = this.slots[blocker.id];
    if (b) b.flash = 0;
    this.fx.shake = Math.max(this.fx.shake, this.L.h * 0.006);
  }

  // ----------------------------------------------------------------- çizim

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;

    // --- sahne senkronu
    const seen: Record<number, boolean> = {};
    for (const car of s.cars) {
      seen[car.id] = true;
      let slot = this.slots[car.id];
      if (!slot) {
        // Asset yolu açıksa müşteri modeli, değilse prosedürel geometri.
        // Karşılaştırma __ART__ sabitine DOĞRUDAN bağlı: ara değişkene alınca
        // esbuild katlayamıyor ve GLTFLoader prosedürel build'e de giriyor.
        const g = (__ART__ === 'atlas' ? modelFor(car.id, car.len) : null) || buildCar(car.len, car.color);
        g.rotation.y = yawFor(car);
        this.world.add(g);
        const mat = (g.children[0] as Mesh).material as MeshPhongMaterial;
        slot = this.slots[car.id] = { car, g, mat, bump: -1, flash: -1 };
      }
      slot.car = car;

      const p = this.worldOf(car);
      let push = 0;
      if (slot.bump >= 0) {
        slot.bump += dt;
        const k = slot.bump / LOT.bumpFor;
        if (k >= 1) slot.bump = -1;
        // İleri atılıp geri gelme: yarım sinüs. Fren yapan araç hissi.
        else push = Math.sin(k * Math.PI) * 0.17;
      }
      const [dc, dr] = step(car.dir);
      slot.g.position.set(p.x + dc * push, DECK, p.z + dr * push);

      if (slot.flash >= 0) {
        slot.flash += dt;
        const k = slot.flash / 0.45;
        if (k >= 1) {
          slot.flash = -1;
          slot.mat.emissive.setRGB(0, 0, 0);
        } else {
          const a = Math.sin(k * Math.PI * 2) * 0.5 + 0.5;
          slot.mat.emissive.setRGB(a * 0.55, 0, 0);
        }
      }
    }
    for (const k in this.slots) {
      if (!seen[this.slots[k].car.id]) {
        this.world.remove(this.slots[k].g);
        delete this.slots[k];
      }
    }

    // --- çıkan araçlar
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const L2 = this.leaving[i];
      L2.t += dt;
      const k = Math.min(1, L2.t / LOT.driveFor);
      const e = k * k; // hızlanarak: durur halden çıkış
      const [dc, dr] = step(L2.car.dir);
      const p = this.worldOf(L2.car);
      const d = e * (L2.car.len + 5);
      L2.g.position.set(p.x + dc * d, DECK, p.z + dr * d);
      L2.g.scale.setScalar(1 - e * 0.15);
      if (k >= 1) {
        this.world.remove(L2.g);
        this.leaving.splice(i, 1);
      }
    }

    // --- bulutlar
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += dt * (0.22 + i * 0.05);
      if (c.position.x > LOT.cols + 5) c.position.x = -5;
    }

    // --- kazanma: konfeti bir kez
    if (s.status === 'won' && this.wonAt < 0) {
      this.wonAt = this.t;
      for (let i = 0; i < 7; i++) {
        this.fx.burst(
          this.L.w * (0.2 + Math.random() * 0.6),
          this.L.h * (0.25 + Math.random() * 0.3),
          Math.max(26, this.L.w * 0.06),
          3,
          ['#F5B62B', '#34C167', '#2F7BE8', '#E8443A', '#8C5BE0'][i % 5]
        );
      }
    } else if (s.status === 'playing') {
      this.wonAt = -1;
    }

    // --- sarsıntı: kamerayı değil DÜNYAYI oynatıyoruz. Kamerayı oynatmak
    // fitCamera'nın kurduğu piksel eşlemesini bozuyor ve dokunma hedefleri
    // kayıyor; dünya grubunu kaydırmak izdüşümü bozmuyor.
    const [shx, shy] = this.fx.shakeOffset(dt);
    // Sarsıntı piksel cinsinden ölçülüyor; dünyaya taşımak için oran gerekiyor.
    this.world.position.set(shx / this.pxPerUnit, shy / this.pxPerUnit, 0);

    this.renderer.render(this.scene, this.camera);

    // --- HUD
    const g2 = this.hudCtx;
    g2.clearRect(0, 0, this.L.w, this.L.h);
    this.fx.draw(g2, dt);
    const hintCarObj = ui.hint ? s.cars.filter((c) => c.id === ui.hint)[0] : null;
    this.hud.draw(s, ui, dt, hintCarObj ? this.carScreenPos(hintCarObj) : null);
  }
}

/** Araç +X'e bakacak şekilde üretiliyor; yön farkı sadece rotasyon. */
function yawFor(car: Car): number {
  return car.dir === 1 ? 0 : car.dir === 3 ? Math.PI : car.dir === 2 ? -Math.PI / 2 : Math.PI / 2;
}

/** Dikey gradient gökyüzü — tek renk arka plan sahneyi düzleştiriyordu. */
function skyTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#4FA8E8');
  grd.addColorStop(0.55, '#A8DCFA');
  grd.addColorStop(1, '#F6E7C2');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  return new CanvasTexture(cv);
}
