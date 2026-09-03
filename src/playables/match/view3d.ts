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
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { M, KINDS, TINT } from './config';
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { visual } from './anim';
import { Fx } from '../../core/fx';
import { pieceFor } from './models';

/** Izgara düzlemi XZ; kamera bu yönden bakıyor. */
const YAW = (0 * Math.PI) / 180;
const PITCH = (62 * Math.PI) / 180;
const DIR = new Vector3(
  Math.sin(YAW) * Math.cos(PITCH),
  Math.sin(PITCH),
  Math.cos(YAW) * Math.cos(PITCH)
).normalize();

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
  private t = 0;

  constructor(gl: HTMLCanvasElement) {
    gl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    const hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(hud);
    this.cv = hud;
    this.hudCtx = hud.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = 'linear-gradient(180deg,#F6E7FB 0%,#EBD7F5 55%,#E4CDEF 100%)';

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    this.scene.add(this.world);

    this.scene.add(new AmbientLight(0xdce8ff, 0.75));
    const key = new DirectionalLight(0xfff6e8, 1.5);
    key.position.set(-2.2, 3.4, 2.6);
    this.scene.add(key);
    const fill = new DirectionalLight(0x9ec4ff, 0.5);
    fill.position.set(2.6, 1.2, -2.0);
    this.scene.add(fill);

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
    const px = 72;
    const cv = document.createElement('canvas');
    cv.width = M.cols * px;
    cv.height = M.rows * px;
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = 'rgba(255,255,255,.62)';
    g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < M.cols * M.rows; i++) {
      const col = i % M.cols;
      const row = (i / M.cols) | 0;
      g.fillStyle = (col + row) % 2 ? 'rgba(139,92,180,.16)' : 'rgba(139,92,180,.07)';
      const m = px * 0.04;
      g.fillRect(col * px + m, row * px + m, px - m * 2, px - m * 2);
    }
    const tex = new CanvasTexture(cv);
    const plane = new Mesh(
      new PlaneGeometry(M.cols, M.rows),
      new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(M.cols / 2, 0, M.rows / 2);
    this.world.add(plane);
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
  }

  burstAt(i: number, kind: number): void {
    const col = i % M.cols;
    const row = (i / M.cols) | 0;
    const [x, y] = this.L.center(col, row);
    this.fx.burst(x, y, this.L.cell * 0.5, 2, TINT[kind] || '#ffffff');
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
      g.scale.setScalar(0.92 * v.scale);
      // Yavaş dönüş: modelin hacmi ancak dönerken okunuyor.
      g.rotation.y = this.t * 0.55 + i * 0.9;
      g.visible = v.alpha > 0.05;
    }
    for (let i = s.cells.length; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot) this.world.remove(slot.g);
      this.slots[i] = null;
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
      g2.strokeStyle = 'rgba(255,214,95,.95)';
      g2.lineWidth = Math.max(2.5, c * 0.06);
      g2.beginPath();
      g2.arc(sx, sy, c * 0.44, 0, Math.PI * 2);
      g2.stroke();
    }
    this.fx.draw(g2, dt);
    this.hud.draw(s, ui, dt);
  }
}
