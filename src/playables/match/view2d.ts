/**
 * 2D renderer — taşlar sprite.
 *
 * Sprite'lar 3D modellerin offline render'ı (bkz. build/render-sprites.mjs).
 * Yani bu sürüm "daha ucuz sanat" kullanmıyor, AYNI sanatı kullanıyor;
 * fark sadece çizim yolunda.
 */
import { M, KINDS, TINT } from './config';
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { visual } from './anim';
import { Fx } from '../../core/fx';
import { roundRect } from '../../core/draw';
import { draw as sprite, ready } from '../../core/atlas';

export class View2D {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private g: CanvasRenderingContext2D;
  private t = 0;

  constructor(cv: HTMLCanvasElement) {
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    this.cv = cv;
    this.g = cv.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = 'linear-gradient(180deg,#F6E7FB 0%,#EBD7F5 55%,#E4CDEF 100%)';
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    this.cv.width = Math.round(this.L.w * this.L.dpr);
    this.cv.height = Math.round(this.L.h * this.L.dpr);
    this.g.setTransform(this.L.dpr, 0, 0, this.L.dpr, 0, 0);
  }

  burstAt(i: number, kind: number): void {
    const c = i % M.cols;
    const r = (i / M.cols) | 0;
    const [x, y] = this.L.center(c, r);
    this.fx.burst(x, y, this.L.cell * 0.5, 2, TINT[kind] || '#ffffff');
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    const g = this.g;
    const L = this.L;
    const c = L.cell;

    const [shx, shy] = this.fx.shakeOffset(dt);
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    g.save();
    g.translate(shx, shy);

    // --- tahta
    const b = L.board;
    const pad = c * 0.14;
    g.save();
    g.shadowColor = 'rgba(70,30,90,.22)';
    g.shadowBlur = c * 0.5;
    g.shadowOffsetY = c * 0.12;
    g.fillStyle = 'rgba(255,255,255,.62)';
    roundRect(g, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, c * 0.34);
    g.fill();
    g.restore();

    for (let i = 0; i < M.cols * M.rows; i++) {
      const col = i % M.cols;
      const row = (i / M.cols) | 0;
      // Dama deseni: hücre sınırı çizgiyle değil tonla veriliyor, daha temiz.
      g.fillStyle = (col + row) % 2 ? 'rgba(139,92,180,.10)' : 'rgba(139,92,180,.05)';
      roundRect(g, b.x + col * c + c * 0.04, b.y + row * c + c * 0.04, c * 0.92, c * 0.92, c * 0.2);
      g.fill();
    }

    // --- seçim
    if (ui.sel >= 0 && s.phase === 'idle') {
      const [sx, sy] = L.center(ui.sel % M.cols, (ui.sel / M.cols) | 0);
      g.strokeStyle = 'rgba(255,214,95,.95)';
      g.lineWidth = Math.max(2.5, c * 0.06);
      roundRect(g, sx - c * 0.46, sy - c * 0.46, c * 0.92, c * 0.92, c * 0.2);
      g.stroke();
    }

    // --- taşlar
    //
    // Düşen taşlar tahtanın ÜSTÜNDEN geliyor; kırpma olmazsa HUD'un üstüne
    // taşıyorlar. Tahta dikdörtgeni + bir hücre pay kadar kırpılıyor.
    if (ready()) {
      g.save();
      g.beginPath();
      g.rect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      g.clip();
      for (let i = 0; i < s.cells.length; i++) {
        const kind = s.cells[i];
        if (kind < 0) continue;
        const v = visual(s, i);
        const [x, y] = L.center(v.col, v.row);
        // Boştaki hafif nefes: tahta tamamen donuk durmasın.
        const idle = s.phase === 'idle' ? 1 + Math.sin(this.t * 2.2 + i * 0.7) * 0.018 : 1;
        g.globalAlpha = v.alpha;
        sprite(g, KINDS[kind], x, y, c * 0.86 * v.scale * idle);
        g.globalAlpha = 1;
      }
      g.restore();
    }

    this.fx.draw(g, dt);
    g.restore();

    this.hud.draw(s, ui, dt);
  }
}
