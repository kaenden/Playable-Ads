/**
 * 2D renderer — taşlar sprite.
 *
 * Sprite'lar 3D modellerin offline render'ı (bkz. build/render-sprites.mjs).
 * Yani bu sürüm "daha ucuz sanat" kullanmıyor, AYNI sanatı kullanıyor;
 * fark sadece çizim yolunda.
 */
import { M, KINDS, TINT, Blast } from './config';
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { visual } from './anim';
import { Fx } from '../../core/fx';
import { BACKDROP, LOOK, paintTray } from './look';
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
    document.body.style.background = BACKDROP;
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    this.cv.width = Math.round(this.L.w * this.L.dpr);
    this.cv.height = Math.round(this.L.h * this.L.dpr);
    this.g.setTransform(this.L.dpr, 0, 0, this.L.dpr, 0, 0);
  }

  burstAt(i: number, kind: number, chain?: number): void {
    const c = i % M.cols;
    const r = (i / M.cols) | 0;
    const [x, y] = this.L.center(c, r);
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
    const g = this.g;
    const L = this.L;
    const c = L.cell;

    const [shx, shy] = this.fx.shakeOffset(dt);
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    g.save();
    g.translate(shx, shy);

    // --- tahta. Çizimi `look.ts` yapıyor: 3D sürüm aynı fonksiyonu doku
    // olarak zemin düzlemine yapıştırıyor, yani iki tahtanın pikselleri
    // birebir aynı.
    const b = L.board;
    const pad = c * 0.14;
    g.save();
    g.shadowColor = 'rgba(12,2,22,.5)';
    g.shadowBlur = c * 0.7;
    g.shadowOffsetY = c * 0.16;
    paintTray(g, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, c, M.cols, M.rows, pad);
    g.restore();

    // --- seçim
    if (ui.sel >= 0 && s.phase === 'idle') {
      const [sx, sy] = L.center(ui.sel % M.cols, (ui.sel / M.cols) | 0);
      g.strokeStyle = LOOK.pick;
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
        // Temas gölgesi: koyu tepside taşlar aksi hâlde havada duruyor.
        g.globalAlpha = v.alpha * 0.5;
        g.fillStyle = 'rgba(10,2,18,.55)';
        g.beginPath();
        g.ellipse(x, y + c * 0.34, c * 0.3 * v.scale, c * 0.11 * v.scale, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = v.alpha;
        sprite(g, KINDS[kind], x, y, c * 0.95 * v.scale * idle);
        g.globalAlpha = 1;
      }
      g.restore();
    }

    this.fx.draw(g, dt);
    g.restore();

    this.hud.draw(s, ui, dt);
  }
}
