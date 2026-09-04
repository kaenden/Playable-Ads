/**
 * HUD — iki renderer da bunu paylaşıyor.
 *
 * Hedef göstergesi paketin KENDİ sprite'ıyla çiziliyor; 3D sürümde de öyle,
 * çünkü HUD orada da WebGL'in üstündeki 2D canvas'ta. Yani 3D birim de küçük
 * 2D atlası gömüyor (11 KB) — HUD'u ayrıca modelden render etmek hem pahalı
 * hem gereksiz olurdu.
 */
import { M, COPY } from './config';
import { State } from './state';
import { Layout, Rect, UiState } from './layout';
import { roundRect, outlinedText, fitFont } from '../../core/draw';
import { draw as sprite } from '../../core/atlas';
import { KINDS } from './config';
import { audio } from '../../core/audio';
import { perf } from '../../core/perf';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

export class Hud {
  t = 0;

  constructor(private g: CanvasRenderingContext2D, private L: Layout) {}

  /**
   * Zincir sözü — "SWEET!", "TASTY!"...
   *
   * Cascade match-3'ün en ödüllendirici anı ve önceki sürümde ekranda hiç
   * karşılığı yoktu: üç taş da patlasa dokuz taş da patlasa aynı
   * görünüyordu. Söz tahtanın ortasında beliriyor, büyüyor ve soluyor.
   */
  combo(text: string): void {
    this.comboText = text;
    this.comboT = 0;
  }

  private comboText = '';
  private comboT = 99;

  private drawCombo(dt: number): void {
    if (this.comboT > 0.9) return;
    this.comboT += dt;
    const g = this.g;
    const L = this.L;
    const p = Math.min(1, this.comboT / 0.9);
    const grow = 1 - Math.pow(1 - Math.min(1, p * 3.4), 2);
    const size = Math.min(L.w * 0.115, 52) * (0.7 + grow * 0.42);
    g.save();
    g.globalAlpha = p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, this.comboText, L.w * 0.8, '900', size, FONT);
    outlinedText(g, this.comboText, L.w / 2, L.board.y + L.board.h * 0.42 - p * L.h * 0.05,
      size, '#FFF6C8', '#FF9AE8', 'rgba(38,6,52,.9)');
    g.restore();
  }

  draw(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    this.header(s);
    if (s.status === 'playing') this.drawCombo(dt);
    if (ui.hint && s.phase === 'idle' && s.status === 'playing') this.hand(ui.hint);
    if (s.status === 'playing') this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3) * 0.02);
    else this.endcard(s);

    if (__AD_NETWORK__ === 'preview') perf.frame(dt, this.g, this.L);
  }

  private header(s: State): void {
    const g = this.g;
    const L = this.L;
    const top = Math.max(12, L.h * 0.024);
    const chipH = Math.min(Math.max(42, L.h * 0.056), 58);
    const clear = 2 * (L.sound.x - 8) - L.w;
    const chipW = Math.max(160, Math.min(L.w * 0.66, 320, clear));
    const cx = (L.w - chipW) / 2;

    const plate = g.createLinearGradient(0, top, 0, top + chipH);
    plate.addColorStop(0, 'rgba(255,255,255,.95)');
    plate.addColorStop(1, 'rgba(240,228,246,.95)');
    g.save();
    g.shadowColor = 'rgba(60,30,80,.28)';
    g.shadowBlur = chipH * 0.34;
    g.shadowOffsetY = chipH * 0.1;
    g.fillStyle = plate;
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.fill();
    g.restore();

    // Hedef: sprite + toplanan/hedef. Yazıyla "collect 10 donuts" demek
    // yerine hedefi GÖSTERMEK, dil bilmeyen izleyicide de çalışıyor.
    const md = chipH - 6;
    const mcx = cx + 3 + md / 2;
    const mcy = top + chipH / 2;
    sprite(g, KINDS[M.target], mcx, mcy, md * 0.92);

    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const label = Math.min(s.collected, M.goal) + ' / ' + M.goal;
    fitFont(g, label, chipW - chipH - 14, '800', chipH * 0.42, FONT);
    outlinedText(g, label, cx + chipH + 2, mcy, chipH * 0.42, '#3B1B4A', '#6A3A7E', 'rgba(255,255,255,.9)');

    // --- hamle pipleri (merge'deki düzen)
    const rowY = top + chipH + Math.max(8, L.h * 0.013);
    const pipH = Math.max(9, L.h * 0.012);
    const b = L.board;
    const gap = Math.max(3, b.w * 0.008);
    const pipW = (b.w - gap * (M.moves - 1)) / M.moves;
    const low = s.moves <= 3;
    for (let i = 0; i < M.moves; i++) {
      const live = i < s.moves;
      const px0 = b.x + i * (pipW + gap);
      g.globalAlpha = live ? (low ? 0.62 + Math.abs(Math.sin(this.t * 6)) * 0.38 : 1) : 1;
      if (live) {
        const pg = g.createLinearGradient(0, rowY, 0, rowY + pipH);
        pg.addColorStop(0, low ? '#FF9A9A' : '#FFD98A');
        pg.addColorStop(1, low ? '#D92F2F' : '#E8930C');
        g.fillStyle = pg;
      } else {
        // Harcanmış hamle yuvası: koyu zeminde koyu bir yuva görünmüyordu.
        g.fillStyle = 'rgba(255,226,252,.16)';
      }
      roundRect(g, px0, rowY, pipW, pipH, pipH / 2);
      g.fill();
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(255,226,252,.72)';
    g.font = '700 ' + Math.round(pipH * 1.05) + 'px ' + FONT;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(COPY.moves + '  ' + s.moves, b.x, rowY + pipH + Math.max(4, pipH * 0.45));

    this.soundBtn();
  }

  private soundBtn(): void {
    const g = this.g;
    const r = this.L.sound;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(255,226,252,.2)';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();

    const u = r.w * 0.13;
    g.fillStyle = '#FFE9FB';
    g.beginPath();
    g.moveTo(cx - u * 1.5, cy - u * 0.6);
    g.lineTo(cx - u * 0.6, cy - u * 0.6);
    g.lineTo(cx + u * 0.4, cy - u * 1.6);
    g.lineTo(cx + u * 0.4, cy + u * 1.6);
    g.lineTo(cx - u * 0.6, cy + u * 0.6);
    g.lineTo(cx - u * 1.5, cy + u * 0.6);
    g.closePath();
    g.fill();

    g.strokeStyle = '#FFE9FB';
    g.lineWidth = Math.max(1.5, u * 0.34);
    if (audio.on) {
      g.beginPath();
      g.arc(cx + u * 0.8, cy, u * 1.05, -0.9, 0.9);
      g.stroke();
      g.beginPath();
      g.arc(cx + u * 0.8, cy, u * 1.75, -0.85, 0.85);
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(cx + u * 0.95, cy - u * 0.95);
      g.lineTo(cx + u * 2.1, cy + u * 0.95);
      g.moveTo(cx + u * 2.1, cy - u * 0.95);
      g.lineTo(cx + u * 0.95, cy + u * 0.95);
      g.stroke();
    }
  }

  /** Tutorial: iki hücre arasında gidip gelen halka + kesikli çizgi. */
  private hand(pair: [number, number]): void {
    const g = this.g;
    const L = this.L;
    const a = L.center(pair[0] % M.cols, (pair[0] / M.cols) | 0);
    const b = L.center(pair[1] % M.cols, (pair[1] / M.cols) | 0);
    const cyc = 1.6;
    const p = (this.t % cyc) / cyc;
    const e = p < 0.75 ? this.ease(p / 0.75) : 1;
    const alpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    const x = a[0] + (b[0] - a[0]) * e;
    const y = a[1] + (b[1] - a[1]) * e;

    g.save();
    g.globalAlpha = alpha * 0.6;
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    g.setLineDash([]);

    g.globalAlpha = alpha;
    const r = L.cell * 0.3;
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = Math.max(2, r * 0.16);
    g.stroke();
    g.restore();

    this.label(COPY.tutorial);
  }

  private label(text: string): void {
    const g = this.g;
    const L = this.L;
    const fs = Math.round(Math.min(Math.max(L.w * 0.042, 13), 22));
    const y = Math.min(L.board.y + L.board.h + fs * 1.5, L.cta.y - fs * 1.5);

    g.font = '800 ' + fs + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pw = g.measureText(text).width + fs * 1.4;
    const ph = fs * 1.7;
    g.fillStyle = 'rgba(50,24,64,.78)';
    roundRect(g, L.w / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
    g.fill();
    outlinedText(g, text, L.w / 2, y, fs, '#ffffff', '#f0dcff', 'rgba(34,14,46,.9)');
  }

  private ctaButton(r: Rect, k: number): void {
    const g = this.g;
    const w = r.w * k;
    const h = r.h * k;
    const x = r.x + (r.w - w) / 2;
    const y = r.y + (r.h - h) / 2;
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, '#57e08a');
    grd.addColorStop(1, '#22a45c');
    g.save();
    g.shadowColor = 'rgba(20,120,70,.45)';
    g.shadowBlur = 18;
    g.fillStyle = grd;
    roundRect(g, x, y, w, h, h * 0.32);
    g.fill();
    g.restore();

    const sweep = (this.t % 2.6) / 2.6;
    if (sweep < 0.42) {
      const sx = x - w * 0.3 + (sweep * (w * 1.9)) / 0.42;
      g.save();
      roundRect(g, x, y, w, h, h * 0.32);
      g.clip();
      const sg = g.createLinearGradient(sx - w * 0.18, 0, sx + w * 0.18, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,.4)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg;
      g.fillRect(x, y, w, h);
      g.restore();
    }

    g.fillStyle = '#04220f';
    g.font = '800 ' + Math.round(h * 0.42) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(COPY.cta, x + w / 2, y + h / 2);
  }

  private endcard(s: State): void {
    const g = this.g;
    const L = this.L;
    const won = s.status === 'won';
    const celebrating = s.endT < M.celebrateFor;

    g.fillStyle = celebrating ? 'rgba(30,12,40,.62)' : 'rgba(30,12,40,.9)';
    g.fillRect(0, 0, L.w, L.h);

    const cy = L.h * (celebrating ? 0.42 : 0.31);
    const size = Math.min(L.w * 0.38, L.h * 0.23);
    const pop = celebrating ? Math.min(1, s.endT / 0.35) : 1;
    const k = (0.6 + 0.4 * this.ease(pop)) * (1 + Math.sin(this.t * 2.4) * 0.04);
    sprite(g, KINDS[M.target], L.w / 2, cy, size * k);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const title = won ? COPY.win : COPY.lose;
    fitFont(g, title, L.w * 0.88, '900', Math.min(L.w * 0.085, 42), FONT);
    g.fillStyle = won ? '#FFD45F' : '#ffffff';
    g.fillText(title, L.w / 2, cy + size * 0.68);

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '600 ' + Math.round(Math.min(L.w * 0.045, 22)) + 'px ' + FONT;
    const sub = won ? s.moves + ' ' + COPY.winSub : COPY.loseSub;
    g.fillText(sub, L.w / 2, cy + size * 0.68 + Math.min(L.w * 0.075, 38));

    if (celebrating) return;

    const fade = Math.min(1, (s.endT - M.celebrateFor) / 0.3);
    g.save();
    g.globalAlpha = fade;

    const by = L.h * 0.6;
    fitFont(g, COPY.brand, L.w * 0.84, '800', Math.min(L.w * 0.075, 34), FONT);
    g.fillStyle = '#FFD45F';
    g.fillText(COPY.brand, L.w / 2, by);
    fitFont(g, COPY.tagline, L.w * 0.84, '500', Math.min(L.w * 0.04, 17), FONT);
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillText(COPY.tagline, L.w / 2, by + Math.min(L.w * 0.065, 30));

    const sr = L.secondary;
    g.strokeStyle = 'rgba(255,255,255,.45)';
    g.lineWidth = 1.5;
    roundRect(g, sr.x, sr.y, sr.w, sr.h, sr.h / 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.font = '700 ' + Math.round(sr.h * 0.38) + 'px ' + FONT;
    g.fillText(COPY.again, sr.x + sr.w / 2, sr.y + sr.h / 2);
    g.restore();

    this.ctaButton(L.cta, 1 + Math.sin(this.t * 3.6) * 0.035);
  }

  private ease(p: number): number {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }
}
