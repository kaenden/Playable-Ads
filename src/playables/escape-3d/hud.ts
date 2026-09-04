/**
 * HUD — başlık, süre barı, tutorial eli, CTA ve kapanış kartı.
 *
 * 3D sahnenin ÜSTÜNDEKİ şeffaf 2D canvas'a çiziliyor; merge'de kurduğumuz
 * düzenin aynısı. Gerçek playable'larda da UI 3D sahnenin içinde değil üstünde.
 *
 * Tutorial elinin nereyi göstereceğini HUD bilmiyor: sahne eğik olduğu için
 * aracın ekran konumunu ancak renderer hesaplayabiliyor, HUD onu parametre
 * olarak alıyor. Böylece aynı HUD hem WebGL hem 2D yedek görünümle çalışıyor.
 */
import { LOT, COPY } from './config';
import { State } from './state';
import { Layout, Rect, UiState } from './layout';
import { roundRect, outlinedText, fitFont } from '../../core/draw';
import { audio } from '../../core/audio';
import { perf } from '../../core/perf';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

/**
 * Oyuncak araba ikonu — 2D. Başlık madalyonunda ve kapanış kartında kullanılıyor.
 * 3D sahnedeki araçla aynı dili konuşuyor: yuvarlak hatlar, koyu kontur,
 * tek beyaz parlama.
 */
export function carIcon(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  const w = s;
  const h = s * 0.62;
  const x = cx - w / 2;
  const y = cy - h / 2;

  g.save();
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(20,12,40,.85)';
  g.lineWidth = Math.max(1.4, s * 0.055);

  // gövde
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, color);
  body.addColorStop(1, shade(color, -0.3));
  g.fillStyle = body;
  roundRect(g, x, y + h * 0.34, w, h * 0.5, h * 0.22);
  g.fill();
  g.stroke();

  // kabin
  g.fillStyle = shade(color, 0.12);
  roundRect(g, x + w * 0.22, y, w * 0.5, h * 0.48, h * 0.2);
  g.fill();
  g.stroke();

  // cam
  g.fillStyle = 'rgba(180,225,255,.92)';
  roundRect(g, x + w * 0.28, y + h * 0.07, w * 0.37, h * 0.28, h * 0.12);
  g.fill();

  // tekerlekler
  g.fillStyle = '#20182f';
  const wr = h * 0.19;
  for (const t of [0.27, 0.73]) {
    g.beginPath();
    g.arc(x + w * t, y + h * 0.86, wr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.arc(x + w * t, y + h * 0.86, wr * 0.38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#20182f';
  }

  // far
  g.fillStyle = '#ffe9a8';
  g.beginPath();
  g.arc(x + w * 0.94, y + h * 0.52, h * 0.08, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Rengi açar (k>0) ya da koyultur (k<0). Palet tek yerden türesin diye. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (sh: number): number => {
    const c = (n >> sh) & 255;
    const v = k >= 0 ? c + (255 - c) * k : c * (1 + k);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return 'rgb(' + f(16) + ',' + f(8) + ',' + f(0) + ')';
}

export class Hud {
  t = 0;
  /** Kalan araç sayısı değişince kısa bir büyüme. */
  private carPunch = 0;
  private lastCars = -1;

  constructor(private g: CanvasRenderingContext2D, private L: Layout) {}

  draw(s: State, ui: UiState, dt: number, hintPos: [number, number] | null): void {
    this.t += dt;
    this.carPunch = Math.max(0, this.carPunch - dt * 2.6);
    this.header(s);
    if (hintPos && ui.hint && s.status === 'playing') this.hand(hintPos);
    if (s.status === 'playing') this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3) * 0.02);
    else this.endcard(s);

    if (__AD_NETWORK__ === 'preview') perf.frame(dt, this.g, this.L);
  }

  private header(s: State): void {
    const g = this.g;
    const top = Math.max(14, this.L.h * 0.026);
    const chipH = Math.min(Math.max(42, this.L.h * 0.058), 58);
    // Çip ses butonuna değmesin: merge'de tam olarak burada çakışma yaşamıştık.
    const clear = 2 * (this.L.sound.x - 8) - this.L.w;
    const chipW = Math.max(160, Math.min(this.L.w * 0.7, 340, clear));
    const cx = (this.L.w - chipW) / 2;

    const plate = g.createLinearGradient(0, top, 0, top + chipH);
    plate.addColorStop(0, 'rgba(255,255,255,.95)');
    plate.addColorStop(1, 'rgba(222,232,246,.95)');
    g.save();
    g.shadowColor = 'rgba(24,40,70,.28)';
    g.shadowBlur = chipH * 0.34;
    g.shadowOffsetY = chipH * 0.1;
    g.fillStyle = plate;
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(38,60,96,.35)';
    g.lineWidth = Math.max(1, chipH * 0.03);
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.stroke();

    // TEK ÇİP, İKİ SAYAÇ.
    //
    // Önce çipin içinde sadece "CLEAR THE LOT" yazıyordu — bir hedef değil
    // bir başlık — ve oyuncunun izlemesi gereken iki sayı (kalan araç ve
    // kalan süre) barın altında minik gri yazılardaydı. Şimdi ikisi de
    // çipte ve büyük: soldaki KAÇ araç kaldığı, sağdaki KAÇ saniyen olduğu.
    const md = chipH - 10;
    const mcy = top + chipH / 2;
    const split = cx + chipW * 0.56;
    g.fillStyle = '#1B2A44';
    g.beginPath();
    g.arc(cx + 5 + md / 2, mcy, md / 2, 0, Math.PI * 2);
    g.fill();
    carIcon(g, cx + 5 + md / 2, mcy, md * 0.74, '#F5B62B');

    // Sayı DEĞİŞİNCE büyüyor: araç çıktığında sayacın da tepki vermesi
    // gerekiyor, yoksa olay sadece tahtada oluyor.
    if (s.cars.length !== this.lastCars) {
      this.lastCars = s.cars.length;
      this.carPunch = 1;
    }
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const left = String(s.cars.length);
    const lfs = chipH * 0.5 * (1 + this.carPunch * 0.24);
    fitFont(g, left, chipW * 0.2, '900', lfs, FONT);
    outlinedText(g, left, cx + chipH + 2, mcy, lfs,
      this.carPunch > 0.02 ? '#0E7A3C' : '#16243C',
      this.carPunch > 0.02 ? '#31C46F' : '#3E5476', 'rgba(255,255,255,.9)');
    g.fillStyle = 'rgba(27,42,68,.6)';
    g.font = '800 ' + Math.round(chipH * 0.2) + 'px ' + FONT;
    g.fillText(COPY.left, cx + chipH + 2 + lfs * 0.72, mcy + 1);

    g.strokeStyle = 'rgba(38,60,96,.22)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(split, top + chipH * 0.22);
    g.lineTo(split, top + chipH * 0.78);
    g.stroke();

    const low = s.time <= 5 && s.status === 'playing';
    const secs = Math.max(0, Math.ceil(s.time));
    g.textAlign = 'center';
    const tvx = split + (cx + chipW - split) * 0.42;
    fitFont(g, String(secs), chipW * 0.2, '900', chipH * 0.5, FONT);
    outlinedText(g, String(secs), tvx, mcy, chipH * 0.5,
      low ? '#C21D1D' : '#16243C', low ? '#FF6A4A' : '#3E5476', 'rgba(255,255,255,.9)');
    g.fillStyle = 'rgba(27,42,68,.6)';
    g.font = '800 ' + Math.round(chipH * 0.2) + 'px ' + FONT;
    g.textAlign = 'left';
    g.fillText(COPY.secs, tvx + chipH * 0.26, mcy + 1);

    // Hedef yazısı çipin ÜSTÜNE, küçük: başlık bilgi değil bağlam.
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(255,255,255,.82)';
    g.font = '800 ' + Math.round(chipH * 0.24) + 'px ' + FONT;
    g.fillText(COPY.goal, this.L.w / 2, top - Math.max(2, chipH * 0.08));
    g.textBaseline = 'middle';

    this.timerBar(s, top + chipH + Math.max(9, this.L.h * 0.015));
    this.soundBtn();
  }

  /**
   * Süre barı. Merge'in hamle piplerinin yerinde duruyor ama BAŞKA bir şey
   * ölçüyor — gerekçesi config.ts'te.
   */
  private timerBar(s: State, y: number): void {
    const g = this.g;
    const b = this.L.board;
    const barW = Math.min(b.w, this.L.w * 0.8);
    const x = (this.L.w - barW) / 2;
    const hgt = Math.max(10, this.L.h * 0.014);
    const p = Math.max(0, Math.min(1, s.time / LOT.timeLimit));
    const low = s.time <= 5 && s.status === 'playing';

    g.fillStyle = 'rgba(20,36,62,.18)';
    roundRect(g, x, y, barW, hgt, hgt / 2);
    g.fill();

    if (p > 0) {
      const fg = g.createLinearGradient(0, y, 0, y + hgt);
      if (low) {
        fg.addColorStop(0, '#FF9A8A');
        fg.addColorStop(1, '#D92F2F');
      } else if (p < 0.45) {
        fg.addColorStop(0, '#FFD98A');
        fg.addColorStop(1, '#E8930C');
      } else {
        fg.addColorStop(0, '#8FF0C0');
        fg.addColorStop(1, '#17A05F');
      }
      g.globalAlpha = low ? 0.6 + Math.abs(Math.sin(this.t * 7)) * 0.4 : 1;
      g.fillStyle = fg;
      roundRect(g, x, y, Math.max(hgt, barW * p), hgt, hgt / 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)';
      roundRect(g, x + hgt * 0.3, y + hgt * 0.2, Math.max(1, barW * p - hgt * 0.6), hgt * 0.26, hgt * 0.13);
      g.fill();
      g.globalAlpha = 1;
    }

    // Barın altındaki yazılar KALDIRILDI: iki sayı da artık çipin içinde,
    // büyük. Bar sadece kalan sürenin görsel karşılığı.
  }

  private soundBtn(): void {
    const g = this.g;
    const r = this.L.sound;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(27,42,68,.14)';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();

    const u = r.w * 0.13;
    g.fillStyle = '#1B2A44';
    g.beginPath();
    g.moveTo(cx - u * 1.5, cy - u * 0.6);
    g.lineTo(cx - u * 0.6, cy - u * 0.6);
    g.lineTo(cx + u * 0.4, cy - u * 1.6);
    g.lineTo(cx + u * 0.4, cy + u * 1.6);
    g.lineTo(cx - u * 0.6, cy + u * 0.6);
    g.lineTo(cx - u * 1.5, cy + u * 0.6);
    g.closePath();
    g.fill();

    g.strokeStyle = '#1B2A44';
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

  /** Tutorial: aracın üstünde nabız atan dokunma halkası + etiket. */
  private hand(p: [number, number]): void {
    const g = this.g;
    const cyc = 1.5;
    const k = (this.t % cyc) / cyc;
    const pulse = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5;
    const r = Math.max(16, Math.min(this.L.w, this.L.h) * 0.045);

    g.save();
    g.globalAlpha = 0.35 * (1 - pulse);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(p[0], p[1], r * (1 + pulse * 0.9), 0, Math.PI * 2);
    g.fill();

    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = Math.max(2.5, r * 0.14);
    g.beginPath();
    g.arc(p[0], p[1], r * (0.72 + pulse * 0.12), 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(20,32,54,.55)';
    g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath();
    g.arc(p[0], p[1], r * (0.72 + pulse * 0.12), 0, Math.PI * 2);
    g.stroke();
    g.restore();

    this.label(COPY.tutorial);
  }

  /**
   * Etiket adanın HEMEN ALTINA oturuyor, ekranın altına değil.
   * Merge'de öğrendiğimiz şey: etiket en geniş boşluğa değil, ait olduğu
   * şeyin yanına konmalı — yoksa ekranda başıboş duruyor.
   */
  private label(text: string): void {
    const g = this.g;
    const fs = Math.round(Math.min(Math.max(this.L.w * 0.042, 13), 22));
    const sc = this.L.scene;
    const y = Math.min(sc.y + sc.h + fs * 1.5, this.L.secondary.y - fs * 1.4);

    g.font = '800 ' + fs + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pw = g.measureText(text).width + fs * 1.4;
    const ph = fs * 1.7;
    g.fillStyle = 'rgba(20,32,54,.78)';
    roundRect(g, this.L.w / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
    g.fill();
    outlinedText(g, text, this.L.w / 2, y, fs, '#ffffff', '#d6e6ff', 'rgba(12,20,36,.9)');
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
    g.shadowColor = 'rgba(20,150,90,.45)';
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

  /** Kapanış İKİ SAHNE — merge'de kurduğumuz düzen (bkz. Sample Ads teardown 02). */
  private endcard(s: State): void {
    const g = this.g;
    const won = s.status === 'won';
    const celebrating = s.endT < LOT.celebrateFor;

    g.fillStyle = celebrating ? 'rgba(10,20,38,.6)' : 'rgba(10,20,38,.88)';
    g.fillRect(0, 0, this.L.w, this.L.h);

    const cy = this.L.h * (celebrating ? 0.44 : 0.32);
    const size = Math.min(this.L.w * 0.4, this.L.h * 0.24);
    const pop = celebrating ? Math.min(1, s.endT / 0.35) : 1;
    const k = (0.6 + 0.4 * this.ease(pop)) * (1 + Math.sin(this.t * 2.4) * 0.04);
    carIcon(g, this.L.w / 2, cy, size * k, won ? '#34C167' : '#E8443A');

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const title = won ? COPY.win : COPY.lose;
    fitFont(g, title, this.L.w * 0.88, '900', Math.min(this.L.w * 0.085, 42), FONT);
    g.fillStyle = won ? '#FFD45F' : '#ffffff';
    g.fillText(title, this.L.w / 2, cy + size * 0.62);

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '600 ' + Math.round(Math.min(this.L.w * 0.045, 22)) + 'px ' + FONT;
    const sub = won ? COPY.winSub + ' ' + s.time.toFixed(1) + 's to spare' : COPY.loseSub;
    g.fillText(sub, this.L.w / 2, cy + size * 0.62 + Math.min(this.L.w * 0.075, 38));

    if (celebrating) return;

    const fade = Math.min(1, (s.endT - LOT.celebrateFor) / 0.3);
    g.save();
    g.globalAlpha = fade;

    const by = this.L.h * 0.62;
    fitFont(g, COPY.brand, this.L.w * 0.84, '800', Math.min(this.L.w * 0.075, 34), FONT);
    g.fillStyle = '#FFD45F';
    g.fillText(COPY.brand, this.L.w / 2, by);
    fitFont(g, COPY.tagline, this.L.w * 0.84, '500', Math.min(this.L.w * 0.04, 17), FONT);
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillText(COPY.tagline, this.L.w / 2, by + Math.min(this.L.w * 0.065, 30));

    const sr = this.L.secondary;
    g.strokeStyle = 'rgba(255,255,255,.45)';
    g.lineWidth = 1.5;
    roundRect(g, sr.x, sr.y, sr.w, sr.h, sr.h / 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.font = '700 ' + Math.round(sr.h * 0.38) + 'px ' + FONT;
    g.fillText(COPY.again, sr.x + sr.w / 2, sr.y + sr.h / 2);
    g.restore();

    this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3.6) * 0.035);
  }

  private ease(p: number): number {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }
}
