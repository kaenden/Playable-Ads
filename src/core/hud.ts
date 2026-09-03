/**
 * HUD — header, timer, tutorial ipucu, butonlar, end card.
 *
 * İki playable da bunu paylaşıyor. 3D sürümde WebGL canvas'ının üstündeki
 * şeffaf 2D canvas'a çiziliyor: gerçek playable'larda da UI 3D sahnenin
 * içinde değil, üstünde 2D olarak duruyor.
 */
import { GAME, COPY } from './config';
import { State } from './state';
import { Layout, Rect, UiState } from './layout';
import { sprite, roundRect, outlinedText } from './art';
import { audio } from './audio';
import { perf } from './perf';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

export class Hud {
  t = 0;

  constructor(private g: CanvasRenderingContext2D, private L: Layout) {}

  draw(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    this.header(s);
    if (ui.hint && ui.dragFrom < 0 && s.status === 'playing') this.hand(ui.hint);
    if (s.status === 'playing') this.buttons(s);
    else this.endcard(s);

    // Cihaz ölçümü — ağ paketlerinde bu blok minify'da tamamen siliniyor.
    if (__AD_NETWORK__ === 'preview') perf.frame(dt, this.g, this.L);
  }

  private header(s: State): void {
    const g = this.g;
    const b = this.L.board;
    const top = Math.max(14, this.L.h * 0.026);

    const chipH = Math.min(Math.max(42, this.L.h * 0.058), 58);
    // Çip ortalanmış, ses butonu sağ üstte: dar ekranda üst üste biniyorlardı.
    // Genişliği butona değmeyecek şekilde kısıtlıyoruz.
    const clear = 2 * (this.L.sound.x - 8) - this.L.w;
    const chipW = Math.max(150, Math.min(b.w, 340, clear));
    const cx = (this.L.w - chipW) / 2;
    // Plaka: gradient + üst kenar ışığı + koyu kontur. Referanslarda header
    // düz bir pill değil, kabartmalı bir panel.
    const plate = g.createLinearGradient(0, top, 0, top + chipH);
    plate.addColorStop(0, 'rgba(96,84,168,.85)');
    plate.addColorStop(1, 'rgba(46,34,102,.9)');
    g.save();
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = chipH * 0.3;
    g.shadowOffsetY = chipH * 0.08;
    g.fillStyle = plate;
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.22)';
    g.lineWidth = Math.max(1, chipH * 0.03);
    roundRect(g, cx + 1, top + 1, chipW - 2, chipH - 2, chipH / 2);
    g.stroke();
    g.strokeStyle = 'rgba(10,5,30,.85)';
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.stroke();

    // Madalyon: hedef yaratık çerçeveli bir daire içinde (Toon Blast'ın
    // karakter portresi gibi) — düz sprite yapıştırmaktan çok daha "oyun".
    const md = chipH - 8;
    const mcx = cx + 4 + md / 2;
    const mcy = top + chipH / 2;
    g.fillStyle = 'rgba(14,8,38,.75)';
    g.beginPath();
    g.arc(mcx, mcy, md / 2, 0, Math.PI * 2);
    g.fill();
    g.drawImage(sprite(GAME.goalLevel, 96), mcx - md / 2, mcy - md / 2, md, md);
    g.strokeStyle = '#ffd45f';
    g.lineWidth = Math.max(1.5, md * 0.07);
    g.beginPath();
    g.arc(mcx, mcy, md / 2, 0, Math.PI * 2);
    g.stroke();

    g.textAlign = 'left';
    g.textBaseline = 'middle';
    // Yazı çipe sığdırılıyor: çip daraldığında metin pill'i taşıp ses
    // butonunun altına giriyordu.
    this.fit(COPY.goal, chipW - chipH - 18, '800', chipH * 0.36);
    outlinedText(g, COPY.goal, cx + chipH + 6, mcy, chipH * 0.36, '#ffffff', '#cdd6ff');

    // Geri sayım barı yerine HAMLE PİPLERİ. Referans match-3 "4 hamle" veriyordu;
    // sayılabilir bir bütçe bardan daha okunur ve kaybı oyuncunun kararı yapıyor.
    const rowY = top + chipH + Math.max(9, this.L.h * 0.016);
    const pipH = Math.max(9, this.L.h * 0.013);
    const n = GAME.moveBudget;
    const gap = Math.max(3, b.w * 0.008);
    const pipW = (b.w - gap * (n - 1)) / n;
    const low = s.moves <= 2;
    for (let i = 0; i < n; i++) {
      const live = i < s.moves;
      const px0 = b.x + i * (pipW + gap);
      g.globalAlpha = live ? (low ? 0.62 + Math.abs(Math.sin(this.t * 6)) * 0.38 : 1) : 1;
      if (live) {
        const pg = g.createLinearGradient(0, rowY, 0, rowY + pipH);
        pg.addColorStop(0, low ? '#ff9a9a' : '#a6f7cd');
        pg.addColorStop(1, low ? '#d92f2f' : '#1f9e63');
        g.fillStyle = pg;
      } else {
        g.fillStyle = 'rgba(255,255,255,.10)';
      }
      roundRect(g, px0, rowY, pipW, pipH, pipH / 2);
      g.fill();
      if (live) {
        g.strokeStyle = 'rgba(10,5,30,.6)';
        g.lineWidth = Math.max(1, pipH * 0.12);
        roundRect(g, px0, rowY, pipW, pipH, pipH / 2);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.45)';
        roundRect(g, px0 + pipW * 0.12, rowY + pipH * 0.18, pipW * 0.76, pipH * 0.26, pipH * 0.13);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '600 ' + Math.round(pipH * 1.05) + 'px ' + FONT;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(COPY.moves + '  ' + s.moves, b.x, rowY + pipH + Math.max(4, pipH * 0.45));

    this.soundBtn();
  }

  /** Ses aç/kapat. Üç referans reklamda da vardı. */
  private soundBtn(): void {
    const g = this.g;
    const r = this.L.sound;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(255,255,255,.10)';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();

    const u = r.w * 0.13;
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath();
    g.moveTo(cx - u * 1.5, cy - u * 0.6);
    g.lineTo(cx - u * 0.6, cy - u * 0.6);
    g.lineTo(cx + u * 0.4, cy - u * 1.6);
    g.lineTo(cx + u * 0.4, cy + u * 1.6);
    g.lineTo(cx - u * 0.6, cy + u * 0.6);
    g.lineTo(cx - u * 1.5, cy + u * 0.6);
    g.closePath();
    g.fill();

    g.strokeStyle = 'rgba(255,255,255,.9)';
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

  private hand(pair: [number, number]): void {
    const g = this.g;
    const a = this.L.cellRect(pair[0]);
    const b = this.L.cellRect(pair[1]);
    const cyc = 1.7;
    const p = (this.t % cyc) / cyc;
    const e = p < 0.75 ? this.ease(p / 0.75) : 1;
    const alpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    const x = a.x + a.w / 2 + (b.x - a.x) * e;
    const y = a.y + a.h / 2 + (b.y - a.y) * e;

    g.save();
    g.globalAlpha = alpha * 0.55;
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(a.x + a.w / 2, a.y + a.h / 2);
    g.lineTo(b.x + b.w / 2, b.y + b.h / 2);
    g.stroke();
    g.setLineDash([]);

    // Dokunma göstergesi: dolu daire altındaki taşı kapatıyordu, halka yapıldı.
    g.globalAlpha = alpha;
    const r = this.L.cell * 0.22;
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = Math.max(2, r * 0.16);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
    g.restore();

    this.label(COPY.tutorial);
  }

  /**
   * Tutorial etiketi. Landscape'te tahta ile + EGG butonu arasında boşluk
   * kalmıyordu ve yazı butonun üstüne biniyordu; bu yüzden etiket en geniş
   * boşluğa yerleşiyor, sığmazsa tahtanın alt kenarına pill olarak oturuyor.
   */
  private label(text: string): void {
    const g = this.g;
    const fs = Math.round(Math.min(Math.max(this.L.cell * 0.26, 13), 24));
    const boardBottom = this.L.board.y + this.L.board.h;
    const below = this.L.spawnBtn.y - boardBottom;
    const y = below > fs * 2.1 ? boardBottom + below / 2 : boardBottom - fs * 1.4;

    g.font = '800 ' + fs + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pw = g.measureText(text).width + fs * 1.4;
    const ph = fs * 1.7;
    g.fillStyle = 'rgba(10,12,32,.72)';
    roundRect(g, this.L.w / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
    g.fill();
    outlinedText(g, text, this.L.w / 2, y, fs, '#ffffff', '#c9d3ff');
  }

  private buttons(s: State): void {
    const g = this.g;
    const sb = this.L.spawnBtn;
    const on = s.charges > 0 && s.status === 'playing';
    g.globalAlpha = on ? 1 : 0.35;
    g.fillStyle = 'rgba(255,255,255,.14)';
    roundRect(g, sb.x, sb.y, sb.w, sb.h, sb.h / 2);
    g.fill();
    g.font = '800 ' + Math.round(sb.h * 0.4) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    outlinedText(g, '+ EGG  (' + s.charges + ')', sb.x + sb.w / 2, sb.y + sb.h / 2, sb.h * 0.4, '#ffffff', '#cfd8ff');
    g.globalAlpha = 1;

    this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3) * 0.02);
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
    g.shadowColor = 'rgba(40,220,130,.45)';
    g.shadowBlur = 18;
    g.fillStyle = grd;
    roundRect(g, x, y, w, h, h * 0.32);
    g.fill();
    g.restore();

    // parlama süpürmesi — CTA'nın canlı kalması için, 2.6sn'de bir geçiyor
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

  /**
   * Kapanış İKİ SAHNE.
   *
   * Toon Blast önce "Level Completed!" + kutlayan karakteri tek başına
   * gösteriyor, marka kartı ve butonlar ancak ondan SONRA geliyordu. Bizde
   * ödül anı ile CTA aynı karede eziliyordu; ayrıldı.
   */
  private endcard(s: State): void {
    const g = this.g;
    const won = s.status === 'won';
    const celebrating = s.endT < GAME.celebrateFor;

    g.fillStyle = celebrating ? 'rgba(6,8,26,.72)' : 'rgba(6,8,26,.9)';
    g.fillRect(0, 0, this.L.w, this.L.h);

    const cy = this.L.h * (celebrating ? 0.44 : 0.33);
    const size = Math.min(this.L.w * 0.42, this.L.h * 0.26);
    // Kutlama sahnesinde ödül büyüyerek giriyor
    const pop = celebrating ? Math.min(1, s.endT / 0.35) : 1;
    const k = (0.6 + 0.4 * this.ease(pop)) * (1 + Math.sin(this.t * 2.4) * 0.04);
    g.drawImage(
      sprite(won ? GAME.goalLevel : s.highest, 192),
      this.L.w / 2 - (size * k) / 2,
      cy - (size * k) / 2,
      size * k,
      size * k
    );

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = won ? '#ffd45f' : '#ffffff';
    const title = won ? COPY.win : COPY.lose;
    this.fit(title, this.L.w * 0.88, '900', Math.min(this.L.w * 0.085, 42));
    g.fillText(title, this.L.w / 2, cy + size * 0.72);

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '600 ' + Math.round(Math.min(this.L.w * 0.045, 22)) + 'px ' + FONT;
    const sub = won
      ? COPY.winSub + ' ' + (GAME.moveBudget - s.moves) + ' moves'
      : COPY.loseSub;
    g.fillText(sub, this.L.w / 2, cy + size * 0.72 + Math.min(this.L.w * 0.075, 38));

    if (celebrating) return;

    // --- marka kartı + iki buton
    const fade = Math.min(1, (s.endT - GAME.celebrateFor) / 0.3);
    g.save();
    g.globalAlpha = fade;

    const by = this.L.h * 0.62;
    g.fillStyle = '#ffd45f';
    this.fit(COPY.brand, this.L.w * 0.84, '800', Math.min(this.L.w * 0.075, 34));
    g.fillText(COPY.brand, this.L.w / 2, by);
    g.fillStyle = 'rgba(255,255,255,.6)';
    this.fit(COPY.tagline, this.L.w * 0.84, '500', Math.min(this.L.w * 0.04, 17));
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

  /** Metni verilen genişliğe sığana kadar küçültür — dar telefonda taşmayı önler. */
  private fit(text: string, maxW: number, weight: string, px: number): void {
    let size = px;
    do {
      this.g.font = weight + ' ' + Math.round(size) + 'px ' + FONT;
      if (this.g.measureText(text).width <= maxW) break;
      size -= 1;
    } while (size > 9);
  }

  private ease(p: number): number {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }
}
