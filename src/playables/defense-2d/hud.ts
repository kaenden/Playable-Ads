/**
 * HUD — başlık, para, can, tutorial, CTA, kapanış kartı.
 *
 * Diğer birimlerden bir farkı var: SAYILAR sistem fontuyla değil, asset
 * paketinin kendi rakam sprite'larıyla yazılıyor (bkz. atlas.drawNumber).
 * Para göstergesi reklamda en çok bakılan yer; oranın oyunun sanatıyla aynı
 * dili konuşması, HUD'un üstüne yapıştırılmış bir web arayüzü gibi
 * durmamasını sağlıyor.
 */
import { TD, WAVE, COPY } from './config';
import { State } from './state';
import { Layout, Rect, UiState } from './layout';
import { roundRect, outlinedText, fitFont } from '../../core/draw';
import { draw as sprite, drawNumber } from './atlas';
import { audio } from '../../core/audio';
import { perf } from '../../core/perf';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

export class Hud {
  t = 0;

  constructor(private g: CanvasRenderingContext2D, private L: Layout) {}

  draw(s: State, ui: UiState, dt: number, hintPos: [number, number] | null): void {
    this.t += dt;
    this.header(s);
    if (hintPos && ui.hint >= 0 && s.status === 'playing') this.hand(hintPos, s);
    if (s.status === 'playing') this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3) * 0.02);
    else this.endcard(s);

    if (__AD_NETWORK__ === 'preview') perf.frame(dt, this.g, this.L);
  }

  private header(s: State): void {
    const g = this.g;
    const L = this.L;
    const top = Math.max(12, L.h * 0.022);
    const chipH = Math.min(Math.max(38, L.h * 0.05), 52);
    const clear = 2 * (L.sound.x - 8) - L.w;
    const chipW = Math.max(150, Math.min(L.w * 0.62, 320, clear));
    const cx = (L.w - chipW) / 2;

    const plate = g.createLinearGradient(0, top, 0, top + chipH);
    plate.addColorStop(0, 'rgba(22,44,30,.88)');
    plate.addColorStop(1, 'rgba(12,28,20,.92)');
    g.save();
    g.shadowColor = 'rgba(0,0,0,.4)';
    g.shadowBlur = chipH * 0.3;
    g.shadowOffsetY = chipH * 0.08;
    g.fillStyle = plate;
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.2)';
    g.lineWidth = Math.max(1, chipH * 0.03);
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.stroke();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, COPY.goal, chipW - 22, '800', chipH * 0.38, FONT);
    outlinedText(g, COPY.goal, L.w / 2, top + chipH / 2, chipH * 0.38, '#ffffff', '#cfe8d2');

    // --- dalga ilerlemesi: öldürülen / toplam
    const barY = top + chipH + Math.max(8, L.h * 0.012);
    const barW = Math.min(L.board.w, L.w * 0.8);
    const bx = (L.w - barW) / 2;
    const bh = Math.max(8, L.h * 0.011);
    g.fillStyle = 'rgba(10,22,16,.35)';
    roundRect(g, bx, barY, barW, bh, bh / 2);
    g.fill();
    const p = s.killed / WAVE.length;
    if (p > 0) {
      const fg = g.createLinearGradient(0, barY, 0, barY + bh);
      fg.addColorStop(0, '#9BE88B');
      fg.addColorStop(1, '#3FA24A');
      g.fillStyle = fg;
      roundRect(g, bx, barY, Math.max(bh, barW * p), bh, bh / 2);
      g.fill();
    }

    const lineY = barY + bh + Math.max(5, bh * 0.5);
    const numH = Math.max(15, L.h * 0.021);

    // --- para: paketin rakam sprite'larıyla
    drawNumber(g, '$' + s.cash, bx, lineY + numH / 2, numH, 'left');

    // --- canlar: sağda, dolu/boş
    const r = numH * 0.32;
    const gap = r * 2.7;
    for (let i = 0; i < TD.lives; i++) {
      const x = bx + barW - r - (TD.lives - 1 - i) * gap;
      const alive = i < s.lives;
      g.beginPath();
      g.arc(x, lineY + numH / 2, r, 0, Math.PI * 2);
      g.fillStyle = alive ? '#E8443A' : 'rgba(255,255,255,.16)';
      g.fill();
      g.lineWidth = Math.max(1, r * 0.28);
      g.strokeStyle = alive ? 'rgba(60,10,10,.7)' : 'rgba(255,255,255,.25)';
      g.stroke();
    }

    this.soundBtn();
  }

  private soundBtn(): void {
    const g = this.g;
    const r = this.L.sound;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(10,26,18,.4)';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();

    const u = r.w * 0.13;
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.beginPath();
    g.moveTo(cx - u * 1.5, cy - u * 0.6);
    g.lineTo(cx - u * 0.6, cy - u * 0.6);
    g.lineTo(cx + u * 0.4, cy - u * 1.6);
    g.lineTo(cx + u * 0.4, cy + u * 1.6);
    g.lineTo(cx - u * 0.6, cy + u * 0.6);
    g.lineTo(cx - u * 1.5, cy + u * 0.6);
    g.closePath();
    g.fill();

    g.strokeStyle = 'rgba(255,255,255,.92)';
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

  /** Tutorial: yuvanın üstünde nabız atan halka + etiket. */
  private hand(p: [number, number], s: State): void {
    const g = this.g;
    const cyc = 1.4;
    const k = (this.t % cyc) / cyc;
    const pulse = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5;
    const r = this.L.cell * 0.42;

    g.save();
    g.globalAlpha = 0.4 * (1 - pulse);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p[0], p[1], r * (1 + pulse * 0.8), 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = Math.max(2.5, r * 0.13);
    g.beginPath();
    g.arc(p[0], p[1], r * (0.78 + pulse * 0.1), 0, Math.PI * 2);
    g.stroke();
    g.restore();

    this.label(s.towers.length ? COPY.tutorial2 : COPY.tutorial);
  }

  private label(text: string): void {
    const g = this.g;
    const L = this.L;
    const fs = Math.round(Math.min(Math.max(L.w * 0.04, 12), 21));
    const y = Math.min(L.board.y + L.board.h + fs * 1.5, L.cta.y - fs * 1.6);

    g.font = '800 ' + fs + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pw = g.measureText(text).width + fs * 1.4;
    const ph = fs * 1.7;
    g.fillStyle = 'rgba(12,26,18,.78)';
    roundRect(g, L.w / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
    g.fill();
    outlinedText(g, text, L.w / 2, y, fs, '#ffffff', '#d8f0d4', 'rgba(8,20,12,.9)');
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
    g.shadowColor = 'rgba(10,90,50,.5)';
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

  /** Kapanış İKİ SAHNE — projedeki diğer üç birimle aynı düzen. */
  private endcard(s: State): void {
    const g = this.g;
    const L = this.L;
    const won = s.status === 'won';
    const celebrating = s.endT < TD.celebrateFor;

    g.fillStyle = celebrating ? 'rgba(8,20,14,.66)' : 'rgba(8,20,14,.9)';
    g.fillRect(0, 0, L.w, L.h);

    const cy = L.h * (celebrating ? 0.42 : 0.31);
    const size = Math.min(L.w * 0.36, L.h * 0.22);
    const pop = celebrating ? Math.min(1, s.endT / 0.35) : 1;
    const k = (0.6 + 0.4 * this.ease(pop)) * (1 + Math.sin(this.t * 2.4) * 0.04);
    sprite(g, won ? 'tower2' : 'tank', L.w / 2, cy, size * k);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const title = won ? COPY.win : COPY.lose;
    fitFont(g, title, L.w * 0.88, '900', Math.min(L.w * 0.085, 42), FONT);
    g.fillStyle = won ? '#FFD45F' : '#ffffff';
    g.fillText(title, L.w / 2, cy + size * 0.66);

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '600 ' + Math.round(Math.min(L.w * 0.045, 22)) + 'px ' + FONT;
    const sub = won
      ? s.lives === TD.lives
        ? COPY.winSub
        : s.lives + ' ' + COPY.winSubN
      : COPY.loseSub;
    g.fillText(sub, L.w / 2, cy + size * 0.66 + Math.min(L.w * 0.075, 38));

    if (celebrating) return;

    const fade = Math.min(1, (s.endT - TD.celebrateFor) / 0.3);
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
