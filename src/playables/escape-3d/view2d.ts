/**
 * WebGL bulunmadığında devreye giren 2D yedek görünüm.
 *
 * merge-3d'de öğrendiğimiz kural: ad container'larının bir kısmı WebGL'siz
 * çalışıyor ve orada `new WebGLRenderer()` patlayınca reklam BEYAZ kalıyor —
 * izlenim yanıyor, CTA hiç görünmüyor. O yüzden her 3D birimin oynanabilir
 * bir yedeği olmak zorunda.
 *
 * Yedek "aynı oyunun daha ucuz hali" değil, AYNI oyun: aynı state, aynı HUD,
 * aynı CTA. Sadece kamera yok — tepeden bakılıyor.
 */
import { LOT } from './config';
import { State, Car, step } from './state';
import { Layout, Rect, UiState } from './layout';
import { Hud, shade } from './hud';
import { Fx } from '../../core/fx';
import { roundRect } from '../../core/draw';
import { EscapeView } from './view';

export class View2D implements EscapeView {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private g: CanvasRenderingContext2D;
  private bumps: Record<number, number> = {};
  private flashes: Record<number, number> = {};
  private leaving: Array<{ car: Car; t: number }> = [];
  private t = 0;
  private wonFired = false;

  constructor(cv: HTMLCanvasElement) {
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    this.cv = cv;
    this.g = cv.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = 'linear-gradient(180deg,#8FD3F7 0%,#BFE6FF 55%,#F6E7C2 100%)';
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    this.cv.width = Math.round(this.L.w * this.L.dpr);
    this.cv.height = Math.round(this.L.h * this.L.dpr);
    this.g.setTransform(this.L.dpr, 0, 0, this.L.dpr, 0, 0);
    const gr = this.L.gridRect();
    const pad = Math.min(gr.w, gr.h) * 0.06;
    this.L.scene = { x: gr.x - pad, y: gr.y - pad, w: gr.w + pad * 2, h: gr.h + pad * 2 };
  }

  cellAt(x: number, y: number): number {
    return this.L.cellAt(x, y);
  }

  private rectOf(car: Car): Rect {
    const a = this.L.cellRect(car.row * LOT.cols + car.col);
    const w = a.w * (car.horiz ? car.len : 1);
    const h = a.h * (car.horiz ? 1 : car.len);
    const inset = Math.min(a.w, a.h) * 0.11;
    return { x: a.x + inset, y: a.y + inset, w: w - inset * 2, h: h - inset * 2 };
  }

  carScreenPos(car: Car): [number, number] {
    const r = this.rectOf(car);
    return [r.x + r.w / 2, r.y + r.h / 2];
  }

  drive(car: Car): void {
    this.leaving.push({ car, t: 0 });
    const p = this.carScreenPos(car);
    this.fx.burst(p[0], p[1], Math.max(20, this.L.w * 0.045), 2, '#ffffff');
  }

  bump(car: Car, blocker: Car): void {
    this.bumps[car.id] = 0;
    this.flashes[blocker.id] = 0;
    this.fx.shake = Math.max(this.fx.shake, this.L.h * 0.006);
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    const g = this.g;
    const L = this.L;
    g.clearRect(0, 0, L.w, L.h);

    const [shx, shy] = this.fx.shakeOffset(dt);
    g.save();
    g.translate(shx, shy);

    // --- otopark zemini
    const gr = L.gridRect();
    const pad = Math.min(gr.w, gr.h) * 0.05;
    g.fillStyle = '#394051';
    roundRect(g, gr.x - pad, gr.y - pad, gr.w + pad * 2, gr.h + pad * 2, pad);
    g.fill();
    g.strokeStyle = 'rgba(255,214,90,.75)';
    g.lineWidth = Math.max(2, pad * 0.22);
    roundRect(g, gr.x - pad * 0.5, gr.y - pad * 0.5, gr.w + pad, gr.h + pad, pad * 0.7);
    g.stroke();

    g.strokeStyle = 'rgba(240,244,255,.42)';
    g.lineWidth = Math.max(1.5, gr.w * 0.006);
    for (let i = 0; i < LOT.cols * LOT.rows; i++) {
      const c = L.cellRect(i);
      const m = c.w * 0.09;
      g.strokeRect(c.x + m, c.y + m, c.w - m * 2, c.h - m * 2);
    }

    // --- çıkan araçlar
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const it = this.leaving[i];
      it.t += dt;
      const k = Math.min(1, it.t / LOT.driveFor);
      if (k >= 1) {
        this.leaving.splice(i, 1);
        continue;
      }
      const [dc, dr] = step(it.car.dir);
      const e = k * k;
      const r = this.rectOf(it.car);
      const d = e * (Math.max(gr.w, gr.h) * 0.75);
      this.drawCar(it.car, { x: r.x + dc * d, y: r.y + dr * d, w: r.w, h: r.h }, 1 - e * 0.4, 0);
    }

    // --- park halindeki araçlar
    for (const car of s.cars) {
      let push = 0;
      if (this.bumps[car.id] !== undefined) {
        this.bumps[car.id] += dt;
        const k = this.bumps[car.id] / LOT.bumpFor;
        if (k >= 1) delete this.bumps[car.id];
        else push = Math.sin(k * Math.PI) * Math.min(gr.w, gr.h) * 0.035;
      }
      let flash = 0;
      if (this.flashes[car.id] !== undefined) {
        this.flashes[car.id] += dt;
        const k = this.flashes[car.id] / 0.45;
        if (k >= 1) delete this.flashes[car.id];
        else flash = Math.sin(k * Math.PI * 2) * 0.5 + 0.5;
      }
      const [dc, dr] = step(car.dir);
      const r = this.rectOf(car);
      this.drawCar(car, { x: r.x + dc * push, y: r.y + dr * push, w: r.w, h: r.h }, 1, flash);
    }

    g.restore();

    if (s.status === 'won' && !this.wonFired) {
      this.wonFired = true;
      for (let i = 0; i < 7; i++) {
        this.fx.burst(
          L.w * (0.2 + Math.random() * 0.6),
          L.h * (0.25 + Math.random() * 0.3),
          Math.max(24, L.w * 0.055),
          3,
          ['#F5B62B', '#34C167', '#2F7BE8', '#E8443A', '#8C5BE0'][i % 5]
        );
      }
    } else if (s.status === 'playing') {
      this.wonFired = false;
    }

    this.fx.draw(g, dt);
    const hintCarObj = ui.hint ? s.cars.filter((c) => c.id === ui.hint)[0] : null;
    this.hud.draw(s, ui, dt, hintCarObj ? this.carScreenPos(hintCarObj) : null);
  }

  /** Tepeden görünüm araç: gövde + kabin + burun oku (yön okunmalı). */
  private drawCar(car: Car, r: Rect, alpha: number, flash: number): void {
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;

    const rad = Math.min(r.w, r.h) * 0.3;
    const base = flash > 0 ? mix(car.color, '#ff3b30', flash * 0.7) : car.color;
    const grd = car.horiz ? g.createLinearGradient(0, r.y, 0, r.y + r.h) : g.createLinearGradient(r.x, 0, r.x + r.w, 0);
    grd.addColorStop(0, shade(base, 0.16));
    grd.addColorStop(1, shade(base, -0.24));

    g.save();
    g.shadowColor = 'rgba(16,26,48,.45)';
    g.shadowBlur = rad * 0.9;
    g.shadowOffsetY = rad * 0.25;
    g.fillStyle = grd;
    roundRect(g, r.x, r.y, r.w, r.h, rad);
    g.fill();
    g.restore();

    g.strokeStyle = 'rgba(20,14,40,.7)';
    g.lineWidth = Math.max(1.5, rad * 0.16);
    roundRect(g, r.x, r.y, r.w, r.h, rad);
    g.stroke();

    // Kabin: aracın ortasında, uzun ekseninde kısa bir blok.
    const cw = car.horiz ? r.w * 0.42 : r.w * 0.66;
    const ch = car.horiz ? r.h * 0.66 : r.h * 0.42;
    g.fillStyle = 'rgba(180,225,255,.9)';
    roundRect(g, r.x + (r.w - cw) / 2, r.y + (r.h - ch) / 2, cw, ch, rad * 0.55);
    g.fill();

    // Burun: aracın çıkacağı yöne bakan üçgen.
    const [dc, dr] = step(car.dir);
    const cx = r.x + r.w / 2 + dc * r.w * 0.5;
    const cy = r.y + r.h / 2 + dr * r.h * 0.5;
    const n = Math.min(r.w, r.h) * 0.22;
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.moveTo(cx + dc * n * 0.2, cy + dr * n * 0.2);
    g.lineTo(cx - dc * n * 0.7 - dr * n * 0.7, cy - dr * n * 0.7 - dc * n * 0.7);
    g.lineTo(cx - dc * n * 0.7 + dr * n * 0.7, cy - dr * n * 0.7 + dc * n * 0.7);
    g.closePath();
    g.fill();

    g.restore();
  }
}

/**
 * İki hex rengi karıştırır — engel yanıp sönmesi için.
 * Çıktı yine HEX: sonucu shade() yeniden ayrıştırıyor, 'rgb()' verirsem orada
 * parseInt NaN döndürür ve araç görünmez olur.
 */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number): number =>
    Math.max(0, Math.min(255, Math.round((((pa >> sh) & 255) * (1 - k)) + (((pb >> sh) & 255) * k))));
  const hx = (n: number): string => (n < 16 ? '0' : '') + n.toString(16);
  return '#' + hx(ch(16)) + hx(ch(8)) + hx(ch(0));
}
