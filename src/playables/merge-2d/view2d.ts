/**
 * Canvas 2D renderer. Oyun mantığını bilmez, sadece State okur.
 * Layout / Hud / Fx core'dan geliyor — 3D sürüm de aynılarını kullanıyor.
 */
import { GAME } from '../../core/config';
import { State } from '../../core/state';
import { Layout, UiState } from '../../core/layout';
import { Hud } from '../../core/hud';
import { Fx } from '../../core/fx';
import { sprite, roundRect, LEVELS } from '../../core/art';

export class View2D {
  g: CanvasRenderingContext2D;
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  private pops: Record<number, number> = {};
  private t = 0;

  constructor(public cv: HTMLCanvasElement) {
    this.g = cv.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    this.cv.width = Math.round(this.L.w * this.L.dpr);
    this.cv.height = Math.round(this.L.h * this.L.dpr);
    this.g.setTransform(this.L.dpr, 0, 0, this.L.dpr, 0, 0);
  }

  burst(index: number, level: number): void {
    const [cx, cy] = this.L.cellCenter(index);
    this.fx.burst(cx, cy, this.L.cell, level, LEVELS[Math.min(level, LEVELS.length) - 1].glow);
    this.pops[index] = 0;
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    const g = this.g;
    const L = this.L;

    const [sx, sy] = this.fx.shakeOffset(dt);
    g.setTransform(L.dpr, 0, 0, L.dpr, sx * L.dpr, sy * L.dpr);

    this.background();
    this.boardBase();

    for (let i = 0; i < s.cells.length; i++) {
      if (i === ui.dragFrom) continue;
      const tile = s.cells[i];
      if (!tile) continue;
      const r = L.cellRect(i);
      let kx = 1;
      let ky = 1;
      if (this.pops[i] !== undefined) {
        this.pops[i] += dt;
        const p = this.pops[i] / 0.34;
        if (p >= 1) {
          delete this.pops[i];
        } else {
          // squash & stretch: eşit ölçek "büyüdü" der, farklı ölçek "canlı" der
          const wv = Math.sin(p * Math.PI);
          kx = 1 + wv * 0.34;
          ky = 1 + wv * 0.16;
        }
      }
      const bw = r.w * 0.94 * kx;
      const bh = r.h * 0.94 * ky;
      g.drawImage(sprite(tile.level, 128), r.x + (r.w - bw) / 2, r.y + (r.h - bh) / 2, bw, bh);
    }

    if (ui.dragFrom >= 0) {
      const tile = s.cells[ui.dragFrom];
      if (tile) {
        const over = L.cellAt(ui.dragX, ui.dragY);
        if (over >= 0 && over !== ui.dragFrom) {
          const t2 = s.cells[over];
          const ok = !t2 || (t2.level === tile.level && tile.level < GAME.maxLevel);
          const r = L.cellRect(over);
          g.strokeStyle = ok ? 'rgba(120,255,170,.95)' : 'rgba(255,110,110,.85)';
          g.lineWidth = Math.max(2, r.w * 0.05);
          roundRect(g, r.x, r.y, r.w, r.h, r.w * 0.22);
          g.stroke();
        }
        const size = L.cell * 1.12;
        g.save();
        g.globalAlpha = 0.95;
        g.drawImage(sprite(tile.level, 128), ui.dragX - size / 2, ui.dragY - size * 0.62, size, size);
        g.restore();
      }
    }

    this.fx.draw(g, dt);
    this.hud.draw(s, ui, dt);
  }

  /**
   * Gradient değil SAHNE. Referans kreatiflerin ikisinde de arkada boyanmış bir
   * dünya vardı (sisli sokak / karlı manzara); bizde düz gradient duruyordu ve
   * "tech demo" hissi oradan geliyordu. Hepsi prosedürel: ay, hâle, üç kat
   * tepe silüeti, sürüklenen közler, vinyet.
   */
  private background(): void {
    const g = this.g;
    const { w, h } = this.L;

    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#150f3a');
    sky.addColorStop(0.42, '#1d1a52');
    sky.addColorStop(0.72, '#2a2160');
    sky.addColorStop(1, '#0b0722');
    g.fillStyle = sky;
    g.fillRect(-24, -24, w + 48, h + 48);

    // ay + hâle
    // Ay, header ile tahta arasındaki ölü alana oturuyor; h*0.13'te hamle
    // pip'lerine çarpıyordu.
    const mx = w * 0.8;
    const my = this.L.board.y - Math.min(w, h) * 0.075;
    const mr = Math.min(w, h) * 0.045;
    const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(255,214,150,.22)');
    halo.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = halo;
    g.fillRect(-24, -24, w + 48, h + 48);
    g.fillStyle = '#ffe6bb';
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(210,170,120,.35)';
    g.beginPath();
    g.arc(mx - mr * 0.28, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2);
    g.arc(mx + mr * 0.3, my + mr * 0.25, mr * 0.15, 0, Math.PI * 2);
    g.fill();

    // yıldızlar
    g.save();
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % w;
      const y = ((i * 71.3) % (h * 0.62));
      const tw = 0.35 + Math.abs(Math.sin(this.t * 1.4 + i)) * 0.65;
      g.globalAlpha = tw * 0.7;
      g.fillStyle = i % 5 === 0 ? '#ffd9a0' : '#cfe0ff';
      g.beginPath();
      g.arc(x, y, i % 7 === 0 ? 1.8 : 1, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // üç kat tepe silüeti — derinlik hissi tek katmanla oluşmuyor
    const layers: Array<[number, string, number]> = [
      [0.66, '#241a55', 0.55],
      [0.74, '#1a1240', 0.75],
      [0.83, '#100a2c', 1],
    ];
    for (const [base, col, amp] of layers) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-24, h);
      const y0 = h * base;
      g.lineTo(-24, y0);
      const steps = 7;
      for (let i = 0; i <= steps; i++) {
        const x = (w + 48) * (i / steps) - 24;
        const peak = y0 - Math.abs(Math.sin(i * 1.7 + base * 9)) * h * 0.075 * amp;
        const cx = x - (w + 48) / steps / 2;
        g.quadraticCurveTo(cx, peak, x, y0 - Math.abs(Math.sin(i * 2.3 + base * 5)) * h * 0.045 * amp);
      }
      g.lineTo(w + 24, h);
      g.closePath();
      g.fill();
    }

    // sürüklenen közler
    g.save();
    for (let i = 0; i < 18; i++) {
      const x = ((i * 97.3) % w) + Math.sin(this.t * 0.4 + i) * 16;
      const y = h - (((i * 61.7 + this.t * 22) % (h * 0.9)));
      g.globalAlpha = 0.5 * (1 - (h - y) / (h * 0.9));
      g.fillStyle = i % 3 === 0 ? '#ffb060' : '#ff8a3c';
      g.beginPath();
      g.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // vinyet — dikkati tahtaya topluyor
    const vig = g.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,2,16,.62)');
    g.fillStyle = vig;
    g.fillRect(-24, -24, w + 48, h + 48);
  }

  /** Tahta artık düz yarı saydam kare değil: kabartmalı plaka + oyulmuş hücreler. */
  private boardBase(): void {
    const g = this.g;
    const b = this.L.board;
    const r = b.w * 0.055;

    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = b.w * 0.06;
    g.shadowOffsetY = b.w * 0.018;
    const plate = g.createLinearGradient(0, b.y, 0, b.y + b.h);
    plate.addColorStop(0, 'rgba(84,72,150,.55)');
    plate.addColorStop(1, 'rgba(38,28,86,.55)');
    g.fillStyle = plate;
    roundRect(g, b.x, b.y, b.w, b.h, r);
    g.fill();
    g.restore();

    // üst kenar ışığı + alt koyu kenar: plakaya kalınlık veriyor
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.lineWidth = Math.max(1, b.w * 0.004);
    roundRect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, r);
    g.stroke();
    g.strokeStyle = 'rgba(8,4,26,.7)';
    roundRect(g, b.x, b.y, b.w, b.h, r);
    g.stroke();

    for (let i = 0; i < GAME.cols * GAME.rows; i++) {
      const c = this.L.cellRect(i);
      const cr = c.w * 0.24;
      // oyuk: koyu dolgu + üstte iç gölge + altta ince rim ışığı
      const well = g.createLinearGradient(0, c.y, 0, c.y + c.h);
      well.addColorStop(0, 'rgba(10,6,32,.55)');
      well.addColorStop(1, 'rgba(28,20,68,.35)');
      g.fillStyle = well;
      roundRect(g, c.x, c.y, c.w, c.h, cr);
      g.fill();

      g.save();
      roundRect(g, c.x, c.y, c.w, c.h, cr);
      g.clip();
      const inner = g.createLinearGradient(0, c.y, 0, c.y + c.h * 0.42);
      inner.addColorStop(0, 'rgba(0,0,0,.4)');
      inner.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = inner;
      g.fillRect(c.x, c.y, c.w, c.h);
      g.restore();

      // Alt kenar ışığı. İlk versiyonda hücrenin ortasına yay çiziyordum ve
      // her karede bir "gülümseme" gibi okunuyordu; artık kenara yapışık.
      g.save();
      roundRect(g, c.x, c.y, c.w, c.h, cr);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,.10)';
      g.lineWidth = Math.max(1, c.w * 0.03);
      roundRect(g, c.x, c.y - c.h * 0.03, c.w, c.h, cr);
      g.stroke();
      g.restore();
    }
  }
}
