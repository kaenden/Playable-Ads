/**
 * 3D renderer — AYNI oyun, taşlar model.
 *
 * Kamera escape-3d'deki tekniğin aynısı: ortografik izdüşüm, ızgara
 * `Layout.board` dikdörtgenine TAM oturuyor. Böylece hit-test, HUD ve
 * tutorial 2D sürümle birebir aynı kodu kullanmaya devam ediyor —
 * karşılaştırmanın adil olması için şart.
 *
 * Kamera hafif eğik (tam tepeden değil): tam dik bakış modelleri sprite
 * gibi gösteriyordu ve "3D sürüm" olmasının bir anlamı kalmıyordu.
 */
import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { M, KINDS, TINT, Blast } from './config';
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { visual } from './anim';
import { Fx } from '../../core/fx';
import { pieceFor } from './models';
import { BACKDROP, LOOK, blobCanvas, glossSweep, glowCanvas, paintTray, sparkle } from './look';

/** Izgara düzlemi XZ; kamera bu yönden bakıyor. */
const YAW = (0 * Math.PI) / 180;
const PITCH = (62 * Math.PI) / 180;
const DIR = new Vector3(
  Math.sin(YAW) * Math.cos(PITCH),
  Math.sin(PITCH),
  Math.cos(YAW) * Math.cos(PITCH)
).normalize();

/** Elle kurulan her dokuya sRGB demek gerekiyor; sebebi buildBoard'da. */
function srgb(t: CanvasTexture): CanvasTexture {
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface Slot {
  kind: number;
  g: Group;
}

export class View3D {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, -100, 200);
  private hudCtx: CanvasRenderingContext2D;
  private world = new Group();
  private slots: Array<Slot | null> = [];
  private shadows: InstancedMesh | null = null;
  /** Parlama haleleri — tür rengini örnek rengiyle taşıyorlar. */
  private glows: InstancedMesh | null = null;
  private gq = new Quaternion();
  private gp = new Vector3();
  private gs = new Vector3();
  private gc = new Color();
  private sm = new Matrix4();
  private hideM = new Matrix4().makeScale(0, 0, 0);
  private t = 0;

  constructor(gl: HTMLCanvasElement) {
    gl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    const hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(hud);
    this.cv = hud;
    this.hudCtx = hud.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = BACKDROP;

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    this.scene.add(this.world);

    // IŞIK KOYU ZEMİNE GÖRE YENİDEN KURULDU. Açık zeminde çalışan yumuşak
    // ortam ışığı erik bir tepsinin üstünde modelleri gri bırakıyordu:
    // ortam ışığı her yüzeye aynı değeri ekler, yani kontrastı yer. Ortam
    // kısıldı, anahtar yükseldi, ve ARKADAN bir kenar ışığı eklendi —
    // koyu zeminde silueti çizen şey o. Bu tam olarak renderer'ın satın
    // aldığı şey; sprite'ta taklidi yok.
    this.scene.add(new AmbientLight(0xffe6ff, 0.42));
    const key = new DirectionalLight(0xfff4e2, 2.05);
    key.position.set(-2.2, 3.4, 2.6);
    this.scene.add(key);
    const fill = new DirectionalLight(0xB98CFF, 0.55);
    fill.position.set(2.6, 1.2, -2.0);
    this.scene.add(fill);
    const rim = new DirectionalLight(0xFFC7F2, 0.9);
    rim.position.set(0.6, 1.6, -3.2);
    this.scene.add(rim);

    this.buildBoard();
    this.hud = new Hud(this.hudCtx, this.L);
    this.resize();
  }

  /**
   * Tahta zemini SAHNENİN İÇİNDE, HUD'da değil.
   *
   * İlk sürümde zemin yoktu ve taşlar arka plan gradyanında havada duruyordu.
   * HUD canvas'ı WebGL'in ÜSTÜNDE olduğu için oraya çizilemez — taşları
   * kapatırdı. Doğru yer sahne: taşların altında, aynı kamerayla.
   *
   * Deseni 2D sürümün tahtasıyla aynı: iki oyun aynı oyun gibi görünmeli.
   */
  private buildBoard(): void {
    // Tepsi TEK TARİFTEN: `look.ts` içindeki aynı fonksiyon 2D sürümde
    // doğrudan tuvale çiziliyor, burada bir dokuya çizilip zemin düzlemine
    // yapıştırılıyor. İki tahtanın pikselleri birebir aynı.
    const px = 72;
    const pad = px * 0.14;
    const cv = document.createElement('canvas');
    cv.width = M.cols * px + pad * 2;
    cv.height = M.rows * px + pad * 2;
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    paintTray(g, 0, 0, cv.width, cv.height, px, M.cols, M.rows, pad);
    const tex = new CanvasTexture(cv);
    // RENK UZAYI ŞART. Varsayılanda CanvasTexture lineer veri sayılıyor ve
    // çıkışta sRGB'ye çevrilirken KOYU değerler ciddi biçimde açılıyor:
    // #2A0940 seçtiğim tepsi ekranda orta mor çıkıyordu. Doku zaten sRGB
    // piksel taşıyor, söylemek yetiyor.
    tex.colorSpace = SRGBColorSpace;
    const plane = new Mesh(
      new PlaneGeometry(M.cols + (pad * 2) / px, M.rows + (pad * 2) / px),
      new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(M.cols / 2, 0, M.rows / 2);
    this.world.add(plane);

    // TEMAS GÖLGELERİ — hepsi tek çizim çağrısı.
    //
    // Koyu tepsi taşları öne çıkardı ama aynı zamanda havada bıraktı:
    // altlarında hiçbir şey yoktu. Hücre başına bir yumuşak leke, taşı
    // zemine oturtuyor ve derinliği okunur yapıyor.
    const bg = new PlaneGeometry(1, 1);
    bg.rotateX(-Math.PI / 2);
    const shadows = new InstancedMesh(
      bg,
      new MeshBasicMaterial({
        map: srgb(new CanvasTexture(blobCanvas(64))),
        transparent: true,
        depthWrite: false,
      }),
      M.cols * M.rows
    );
    shadows.frustumCulled = false;
    shadows.renderOrder = -1;
    this.shadows = shadows;
    this.world.add(shadows);

    // PARLAMA HALELERİ — kameraya bakan, toplamalı karıştırılan kareler.
    //
    // Gerçek bir bloom bu bütçede pahalı ve gereksiz. Taşın arkasına konan
    // yumuşak bir ışık aynı izlenimi veriyor, ve daha önemlisi RENK
    // getiriyor: paketin yemekleri soluk ve birbirine yakın, hale ise her
    // türü kendi rengiyle işaretliyor. Renk örnek başına taşınıyor
    // (`setColorAt`), yani beş tür tek çizim çağrısında.
    const ggeo = new PlaneGeometry(1, 1);
    const glows = new InstancedMesh(
      ggeo,
      new MeshBasicMaterial({
        map: srgb(new CanvasTexture(glowCanvas(128))),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      M.cols * M.rows
    );
    glows.frustumCulled = false;
    for (let i = 0; i < M.cols * M.rows; i++) glows.setColorAt(i, this.gc.set(0xffffff));
    this.glows = glows;
    this.world.add(glows);
  }

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
   * Izgarayı L.board'a tam oturt. Dünya birimi = 1 hücre; ızgara XZ
   * düzleminde (0,0)–(cols,rows) arasında duruyor.
   */
  private fitCamera(): void {
    const L = this.L;
    const cam = this.camera;
    const c = new Vector3(M.cols / 2, 0, M.rows / 2);
    cam.position.copy(c).addScaledVector(DIR, 40);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld(true);

    // Sınır kutusu: ızgara + taş yüksekliği payı.
    const inv = cam.matrixWorldInverse;
    const v = new Vector3();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? M.cols : 0, i & 2 ? 0.7 : -0.2, i & 4 ? M.rows : 0).applyMatrix4(inv);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const s = Math.min(L.board.w / bw, L.board.h / bh);
    const tx = L.board.x + (L.board.w - bw * s) / 2;
    const ty = L.board.y + (L.board.h - bh * s) / 2;

    cam.left = minX - tx / s;
    cam.right = cam.left + L.w / s;
    cam.top = maxY + ty / s;
    cam.bottom = cam.top - L.h / s;
    cam.updateProjectionMatrix();
    // Haleler bu dönüşü kullanıyor; kamera sabit olduğu için bir kez yeter.
    this.gq.copy(cam.quaternion);
  }

  burstAt(i: number, kind: number, chain?: number): void {
    const col = i % M.cols;
    const row = (i / M.cols) | 0;
    const [x, y] = this.L.center(col, row);
    this.fx.burst(x, y, this.L.cell * (0.5 + Math.min(3, (chain || 1) - 1) * 0.12),
      2 + Math.min(3, (chain || 1) - 1), TINT[kind] || '#ffffff');
  }

  /**
   * Roket ve bomba efekti.
   *
   * Satır roketi enine bir ışın, sütun roketi boyuna; bomba ise merkezde
   * geniş bir patlama. Üçü de sarsıntı veriyor, çünkü bu birimde tek
   * ödüllendirici an bu.
   */
  blastAt(b: Blast): void {
    const L = this.L;
    const col = b.at % M.cols;
    const row = (b.at / M.cols) | 0;
    const [x, y] = L.center(col, row);
    if (b.kind === 'row') {
      this.fx.beam(L.board.x + L.board.w / 2, y, L.board.w, L.cell * 0.62, LOOK.beam);
    } else if (b.kind === 'col') {
      this.fx.beam(x, L.board.y + L.board.h / 2, L.cell * 0.62, L.board.h, LOOK.beam);
    } else {
      this.fx.burst(x, y, L.cell * 1.15, 6, LOOK.beam);
    }
    this.fx.burst(x, y, L.cell * 0.8, 4, LOOK.spark);
    this.fx.shake = Math.max(this.fx.shake, L.h * 0.012);
  }

  /** Füzyon anı: taşların birleştiği noktada beyaz bir şimşek. */
  flashAt(col: number, row: number, chain: number): void {
    const [x, y] = this.L.center(col, row);
    this.fx.burst(x, y, this.L.cell * (0.7 + chain * 0.08), 4, LOOK.spark);
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;

    for (let i = 0; i < s.cells.length; i++) {
      const kind = s.cells[i];
      let slot = this.slots[i];

      if (kind < 0) {
        if (slot) {
          this.world.remove(slot.g);
          this.slots[i] = null;
        }
        continue;
      }
      if (!slot || slot.kind !== kind) {
        if (slot) this.world.remove(slot.g);
        const g = pieceFor(KINDS[kind]);
        if (!g) continue;
        this.world.add(g);
        slot = this.slots[i] = { kind, g };
      }

      const v = visual(s, i);
      // Hücre merkezleri: (col+0.5, row+0.5). Ekrandaki satır aşağı doğru
      // artıyor, dünyada +Z; 2D ile aynı yönü koruyor.
      const g = slot.g;
      g.position.set(v.col + 0.5, 0.4 * v.scale, v.row + 0.5);
      g.scale.setScalar(1.02 * v.scale);
      // Yavaş dönüş: modelin hacmi ancak dönerken okunuyor.
      g.rotation.y = this.t * 0.55 + i * 0.9;
      g.visible = v.alpha > 0.05;
      if (this.glows) {
        // Hale KAMERAYA bakıyor: yere yatık bir ışık havuzu tepside
        // eziliyor ve "parlama" değil "leke" okunuyor.
        // HALE MODELİN ARKASINA ÇEKİLİYOR.
        //
        // Kameraya bakan kare taşın TAM ÜSTÜNDEYKEN modelin içinden
        // geçiyordu: karenin bir yarısı modelin önünde, yarısı arkasında
        // kalıyor ve taş ikiye bölünmüş gibi iki farklı tonda görünüyordu.
        // Muzda ve çörekte en belirgindi. Kamera yönünde geriye itmek
        // kesişmeyi tamamen bitiriyor; hale artık sadece arkadan taşan
        // bir ışık.
        const gk = 1.5 * v.scale * (v.alpha > 0.05 ? 1 : 0);
        this.gp.set(v.col + 0.5, 0.42 * v.scale, v.row + 0.5).addScaledVector(DIR, -1.1);
        this.gs.set(gk, gk, gk);
        this.sm.compose(this.gp, this.gq, this.gs);
        this.glows.setMatrixAt(i, this.sm);
        this.gc.set(TINT[kind] || '#ffffff');
        this.glows.setColorAt(i, this.gc);
      }
      if (this.shadows) {
        // Gölge YERDE kalıyor ve taş büyüdükçe yayılıyor.
        const k = 0.78 * v.scale * (v.alpha > 0.05 ? 1 : 0);
        this.sm.makeScale(k, 1, k * 0.62);
        this.sm.setPosition(v.col + 0.5, 0.012, v.row + 0.62);
        this.shadows.setMatrixAt(i, this.sm);
      }
    }
    for (let i = s.cells.length; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot) this.world.remove(slot.g);
      this.slots[i] = null;
    }
    if (this.shadows) {
      for (let i = 0; i < M.cols * M.rows; i++) {
        if (s.cells[i] === undefined || s.cells[i] < 0) {
          this.shadows.setMatrixAt(i, this.hideM);
          if (this.glows) this.glows.setMatrixAt(i, this.hideM);
        }
      }
      this.shadows.instanceMatrix.needsUpdate = true;
    }
    if (this.glows) {
      this.glows.instanceMatrix.needsUpdate = true;
      if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;
    }

    const [shx, shy] = this.fx.shakeOffset(dt);
    this.world.position.set(shx * 0.01, shy * 0.01, 0);
    this.renderer.render(this.scene, this.camera);

    // --- HUD + tahta zemini (2D katman, WebGL'in üstünde)
    const g2 = this.hudCtx;
    const L = this.L;
    g2.clearRect(0, 0, L.w, L.h);
    if (ui.sel >= 0 && s.phase === 'idle') {
      const [sx, sy] = L.center(ui.sel % M.cols, (ui.sel / M.cols) | 0);
      const c = L.cell;
      g2.strokeStyle = LOOK.pick;
      g2.lineWidth = Math.max(2.5, c * 0.06);
      g2.beginPath();
      g2.arc(sx, sy, c * 0.44, 0, Math.PI * 2);
      g2.stroke();
    }
    // Pırıltılar ve ışık şeridi 2D katmanda: 3D'de yapmanın hiçbir kazancı
    // yok ve 2D sürümle birebir aynı kod çalışıyor.
    const b2 = L.board;
    const pad2 = L.cell * 0.14;
    for (let i = 0; i < M.cols * M.rows; i++) {
      if (s.cells[i] === undefined || s.cells[i] < 0) continue;
      const ph = (this.t * 0.62 + i * 0.41) % 5.2;
      if (ph > 0.55) continue;
      const k = Math.sin((ph / 0.55) * Math.PI);
      const [px2, py2] = L.center(i % M.cols, (i / M.cols) | 0);
      sparkle(g2, px2 + L.cell * 0.22, py2 - L.cell * 0.26, L.cell * 0.2, k);
    }
    glossSweep(g2, b2.x - pad2, b2.y - pad2, b2.w + pad2 * 2, b2.h + pad2 * 2, this.t);

    this.fx.draw(g2, dt);
    this.hud.draw(s, ui, dt);
  }
}
