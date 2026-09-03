/**
 * Three.js renderer. state.ts'e HİÇ dokunmadan view2d.ts'in yerine geçiyor.
 *
 * Kritik tasarım kararı: PerspectiveCamera, z=0 düzlemi PİKSEL BİREBİR olacak
 * şekilde kuruluyor (görünür yükseklik = ekran yüksekliği). Böylece Layout'un
 * hesapladığı ekran dikdörtgenleri 3D dünyada da geçerli — hit-test, CTA konumu
 * ve tutorial ipucu 2D sürümle aynı kodu kullanmaya devam ediyor.
 * z>0'daki objeler kameraya yaklaştığı için gerçek perspektif korunuyor.
 *
 * HUD ayrı bir 2D canvas'ta, WebGL canvas'ının üstünde. Gerçek playable'larda
 * da UI 3D sahnenin içinde değil üstünde duruyor.
 */
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Group,
  Mesh,
  MeshPhongMaterial,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  MathUtils,
} from 'three';
import { GAME } from '../../core/config';
import { State } from '../../core/state';
import { Layout, UiState } from '../../core/layout';
import { Hud } from '../../core/hud';
import { Fx } from '../../core/fx';
import { LEVELS } from '../../core/art';
import { creature } from './creatures';
import { modelFor } from './models';


const FOV = 30;

export class View3D {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement; // input hedefi = HUD canvas (en üstteki)

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private hudCtx: CanvasRenderingContext2D;
  private tiles: Record<number, { id: number; g: Group }> = {};
  private cells: Group;
  private pops: Record<number, number> = {};
  private t = 0;
  private key: DirectionalLight;

  constructor(gl: HTMLCanvasElement) {
    gl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    const hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(hud);
    this.cv = hud;
    this.hudCtx = hud.getContext('2d') as CanvasRenderingContext2D;

    document.body.style.background = 'linear-gradient(180deg,#1b1f52 0%,#141838 55%,#0a0c23 100%)';

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    this.camera = new PerspectiveCamera(FOV, 1, 1, 10000);

    this.scene.add(new HemisphereLight(0x9fb8ff, 0x2a1b4a, 1.15));
    this.key = new DirectionalLight(0xffffff, 1.5);
    this.scene.add(this.key);
    const warm = new PointLight(0xffb060, 0.9, 0, 2);
    this.key.add(warm);

    this.cells = new Group();
    this.scene.add(this.cells);

    this.hud = new Hud(this.hudCtx, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    const { w, h, dpr } = this.L;

    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);

    // Görünür yükseklik z=0'da tam ekran yüksekliği olsun -> 1 birim = 1 CSS px
    const dist = h / 2 / Math.tan(MathUtils.degToRad(FOV) / 2);
    this.camera.fov = FOV;
    this.camera.aspect = w / h;
    this.camera.near = dist * 0.1;
    this.camera.far = dist * 3;
    this.camera.position.set(w / 2, h / 2, dist);
    this.camera.lookAt(w / 2, h / 2, 0);
    this.camera.updateProjectionMatrix();

    this.key.position.set(w * 0.25, h * 1.1, dist * 0.55);
    this.key.target.position.set(w / 2, h / 2, 0);
    this.scene.add(this.key.target);

    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.buildBoard();
  }

  /** Ekran koordinatı -> dünya koordinatı (y ekseni ters). */
  private world(sx: number, sy: number): [number, number] {
    return [sx, this.L.h - sy];
  }

  private buildBoard(): void {
    this.cells.clear();
    const c = this.L.cell;
    const geo = new BoxGeometry(c, c, c * 0.16);
    const mat = new MeshPhongMaterial({ color: 0x2a2f63, shininess: 8 });
    for (let i = 0; i < GAME.cols * GAME.rows; i++) {
      const [sx, sy] = this.L.cellCenter(i);
      const [x, y] = this.world(sx, sy);
      const m = new Mesh(geo, mat);
      m.position.set(x, y, -c * 0.34);
      this.cells.add(m);
    }
    const b = this.L.board;
    const base = new Mesh(
      new BoxGeometry(b.w * 1.02, b.h * 1.02, c * 0.1),
      new MeshPhongMaterial({ color: 0x1d2150, shininess: 4 })
    );
    const [bx, by] = this.world(b.x + b.w / 2, b.y + b.h / 2);
    base.position.set(bx, by, -c * 0.46);
    this.cells.add(base);
  }

  burst(index: number, level: number): void {
    const [cx, cy] = this.L.cellCenter(index);
    this.fx.burst(cx, cy, this.L.cell, level, LEVELS[Math.min(level, LEVELS.length) - 1].glow);
    this.pops[index] = 0;
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    const L = this.L;
    const c = L.cell;

    // ---- sahne senkronu: state neredeyse mesh oraya
    const seen: Record<number, boolean> = {};
    for (let i = 0; i < s.cells.length; i++) {
      const tile = s.cells[i];
      if (!tile) continue;
      seen[i] = true;
      let slot = this.tiles[i];
      if (!slot || slot.id !== tile.id) {
        if (slot) this.scene.remove(slot.g);
        // Asset hattı açıksa GLB'den, değilse prosedürel geometriden.
        // Karşılaştırma __ART__ sabitine DOĞRUDAN bağlı: ara değişkene alınca
        // esbuild katlayamıyor ve GLTFLoader prosedürel build'e de giriyordu
        // (575 -> 652 KB). Aynı tuzağa CTA dallarında da düşmüştük.
        const model = __ART__ === 'atlas' ? modelFor(tile.level, c) : null;
        const g = new Group();
        g.add(model || creature(tile.level, c));
        this.scene.add(g);
        slot = this.tiles[i] = { id: tile.id, g };
      }

      let scale = 1;
      if (this.pops[i] !== undefined) {
        this.pops[i] += dt;
        const p = this.pops[i] / 0.34;
        if (p >= 1) delete this.pops[i];
        else scale = 1 + Math.sin(p * Math.PI) * 0.3;
      }

      const g = slot.g;
      if (i === ui.dragFrom) {
        const [x, y] = this.world(ui.dragX, ui.dragY - c * 0.1);
        g.position.set(x, y, c * 0.55);
        g.scale.setScalar(scale * 1.1);
      } else {
        const [sx, sy] = L.cellCenter(i);
        const [x, y] = this.world(sx, sy);
        g.position.set(x, y + Math.sin(this.t * 1.6 + i) * c * 0.035, 0);
        g.scale.setScalar(scale);
      }
      g.rotation.y = Math.sin(this.t * 0.7 + i * 1.3) * 0.35;
    }

    for (const k in this.tiles) {
      const i = +k;
      if (!seen[i]) {
        this.scene.remove(this.tiles[i].g);
        delete this.tiles[i];
      }
    }

    // ---- sarsıntı kamerada
    const [shx, shy] = this.fx.shakeOffset(dt);
    this.camera.position.x = L.w / 2 + shx;
    this.camera.position.y = L.h / 2 + shy;

    this.renderer.render(this.scene, this.camera);

    // ---- HUD (üstteki 2D canvas)
    const g2 = this.hudCtx;
    g2.clearRect(0, 0, L.w, L.h);
    if (ui.dragFrom >= 0) {
      const over = L.cellAt(ui.dragX, ui.dragY);
      const tile = s.cells[ui.dragFrom];
      if (over >= 0 && over !== ui.dragFrom && tile) {
        const t2 = s.cells[over];
        const ok = !t2 || (t2.level === tile.level && tile.level < GAME.maxLevel);
        const r = L.cellRect(over);
        g2.strokeStyle = ok ? 'rgba(120,255,170,.95)' : 'rgba(255,110,110,.85)';
        g2.lineWidth = Math.max(2, r.w * 0.05);
        g2.strokeRect(r.x, r.y, r.w, r.h);
      }
    }
    this.fx.draw(g2, dt);
    this.hud.draw(s, ui, dt);
  }
}

