/**
 * HUD — 3D sahnenin ÜSTÜNDEKİ 2D katman.
 *
 * ARAYÜZ DE BU OYUNA AİT. Gate Crashers'tan devralındığında krem çipler ve
 * turuncu bir CTA taşıyordu; sahne adaya taşınınca arayüz hâlâ öteki oyunun
 * arayüzüydü ve ikisi ekranda aynı ürün gibi duruyordu. Bu birimin kendi
 * düzeni: koyu levhalar, turkuaz ilerleme, kırmızı CTA — ve altın SADECE
 * silaha ayrılmış durumda, çünkü bu oyunda kazanılan şey o.
 * Aynı kod, aynı yerleşim, farklı kimlik.
 *
 * Projedeki alışkanlık: arayüz hiçbir zaman 3D'de çizilmiyor. Yazı, buton ve
 * efektler ekran çözünürlüğünde 2D canvas'ta duruyor; hem her cihazda net
 * çıkıyor hem de WebGL'siz yedek görünüm aynı HUD'u paylaşabiliyor.
 *
 * EKRANDAKİ TEK SAYI KALABALIK. Süre yok, hamle yok, skor yok. Oyuncunun
 * takip etmesi gereken tek şey ordusunun büyüklüğü; kapanış kartı da o sayıyı
 * duvarın istediğiyle yan yana koyuyor.
 */
import { STRIKE, TRACK, TRACK_LEN, COPY, BOSS_HP } from './config';
import { State } from './state';
import { Layout, Rect, UiState } from './layout';
import { roundRect, outlinedText, fitFont } from '../../core/draw';
import { weaponIcon, weaponName, weaponTier } from './weapons';
import { audio } from '../../core/audio';
import { perf } from '../../core/perf';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  /** Punto çarpanı — kritik hasar normalden büyük yazılıyor. */
  k: number;
  /**
   * Ömür (saniye). Kritikler KISA yaşıyor: beşte bir atış kritik, yani
   * uzun ömürlü olsalar üst üste binip ekranı kapatıyorlar. Kapı ve ceza
   * balonları seyrek olduğu için uzun kalabiliyor.
   */
  dur: number;
}

export class Hud {
  t = 0;
  /** Sayaç hedefe akarak gidiyor — anlık zıplayan sayı okunmuyor. */
  private shown = STRIKE.startCrowd;
  /** Sayı değişince kısa bir büyüme: gözün kaçırmaması için. */
  private punch = 0;
  /** Silah kartının yükselme vurgusu — 0'da tam vurgu, 1'de sönmüş. */
  private wepPop = 1;
  private lastWeapon = STRIKE.startWeapon;
  private punchUp = true;
  private lastCount = STRIKE.startCrowd;
  private pops: Pop[] = [];

  constructor(private g: CanvasRenderingContext2D, private L: Layout) {}

  /** Kalabalığın üstünde yükselen "+5" / "-3" yazısı. */
  pop(x: number, y: number, text: string, color: string, k?: number, dur?: number): void {
    this.pops.push({ x, y, text, color, life: 0, k: k || 1, dur: dur || 1.05 });
  }

  reset(): void {
    this.shown = STRIKE.startCrowd;
    this.lastCount = STRIKE.startCrowd;
    this.punch = 0;
    this.pops.length = 0;
  }

  draw(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    if (s.crowd !== this.lastCount) {
      this.punchUp = s.crowd > this.lastCount;
      this.lastCount = s.crowd;
      this.punch = 1;
    }
    this.punch = Math.max(0, this.punch - dt * 2.6);
    if (s.weapon !== this.lastWeapon) {
      this.lastWeapon = s.weapon;
      this.wepPop = 0;
    }
    this.wepPop = Math.min(1, this.wepPop + dt * 1.8);
    this.shown += (s.crowd - this.shown) * (1 - Math.exp(-9 * dt));
    if (Math.abs(s.crowd - this.shown) < 0.02) this.shown = s.crowd;

    this.header(s);
    this.weaponCard(s);
    this.bossBar(s);
    this.drawPops(dt);
    if (s.pre > 0) this.countdown(s.pre);
    if (ui.hint && s.status === 'playing') this.swipeHint();
    if (s.status === 'playing') this.ctaButton(this.L.cta, 1 + Math.sin(this.t * 3) * 0.02);
    else if (s.endT > STRIKE.endAfter) this.endcard(s);

    if (__AD_NETWORK__ === 'preview') perf.frame(dt, this.g, this.L);
  }

  private header(s: State): void {
    const g = this.g;
    const L = this.L;
    const top = Math.max(12, L.h * 0.024);
    const chipH = Math.min(Math.max(46, L.h * 0.062), 64);
    // Ses düğmesine çarpmasın: çipin en fazla genişliği ondan geriye kalan.
    const clear = 2 * (L.sound.x - 10) - L.w;
    const chipW = Math.max(150, Math.min(L.w * 0.56, 280, clear));
    const cx = (L.w - chipW) / 2;

    g.save();
    g.shadowColor = 'rgba(10,24,44,.34)';
    g.shadowBlur = chipH * 0.32;
    g.shadowOffsetY = chipH * 0.1;
    const plate = g.createLinearGradient(0, top, 0, top + chipH);
    plate.addColorStop(0, 'rgba(30,42,60,.92)');
    plate.addColorStop(1, 'rgba(18,26,40,.92)');
    g.fillStyle = plate;
    roundRect(g, cx, top, chipW, chipH, chipH / 2);
    g.fill();
    g.restore();

    // Adam ikonu — kalabalığın birimi. Yazıyla "crowd" demek yerine
    // GÖSTERMEK dil bilmeyen izleyicide de çalışıyor.
    this.person(cx + chipH * 0.62, top + chipH / 2, chipH * 0.5, '#EAF3FF');

    // Sayının kendisi de tepki veriyor: artışta büyüyüp yeşile, kayıpta
    // büyüyüp kırmızıya kaçıyor. Sadece rakamın değişmesi gözden kaçıyordu.
    const n = Math.round(this.shown);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const label = String(n);
    const k = 1 + this.punch * 0.22;
    const fs = chipH * 0.56 * k;
    fitFont(g, label, chipW - chipH * 1.2, '900', fs, FONT);
    const hot = this.punch > 0.02;
    outlinedText(g, label, cx + chipH * 1.05, top + chipH / 2, fs,
      hot ? (this.punchUp ? '#7CF0AE' : '#FF8A86') : '#FFFFFF',
      hot ? (this.punchUp ? '#37B36C' : '#E5484D') : '#A8C6E4',
      'rgba(8,14,24,.92)');

    g.fillStyle = 'rgba(190,214,238,.6)';
    g.font = '800 ' + Math.round(chipH * 0.24) + 'px ' + FONT;
    g.textAlign = 'right';
    g.fillText(COPY.crowd, cx + chipW - chipH * 0.4, top + chipH / 2);

    this.progress(s, top + chipH + Math.max(9, L.h * 0.014));
    this.soundBtn();
  }

  /** Parkur çubuğu: kapılar ve engeller işaretli, koşucu üstünde ilerliyor. */
  private progress(s: State, y: number): void {
    const g = this.g;
    const L = this.L;
    const m = Math.max(16, L.w * 0.07);
    const w = L.w - m * 2;
    const h = Math.max(6, L.h * 0.008);

    g.fillStyle = 'rgba(16,28,44,.3)';
    roundRect(g, m, y, w, h, h / 2);
    g.fill();

    const p = Math.min(1, s.z / TRACK_LEN);
    const fg = g.createLinearGradient(m, 0, m + w, 0);
    fg.addColorStop(0, '#FFFFFF');
    fg.addColorStop(1, '#2CC8C0');
    g.fillStyle = fg;
    roundRect(g, m, y, Math.max(h, w * p), h, h / 2);
    g.fill();

    for (const ev of TRACK) {
      const x = m + w * (ev.z / TRACK_LEN);
      const done = s.z >= ev.z;
      g.fillStyle = (ev.type === 'target' && !!ev.boss)
        ? '#E5484D'
        : done ? 'rgba(255,255,255,.9)' : 'rgba(16,28,44,.5)';
      const r = (ev.type === 'target' && !!ev.boss) ? h * 0.95 : h * 0.62;
      g.beginPath();
      g.arc(x, y + h / 2, r, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#fff';
    g.strokeStyle = 'rgba(16,28,44,.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(m + w * p, y + h / 2, h * 1.05, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  private person(cx: number, cy: number, size: number, color: string): void {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, cy - size * 0.26, size * 0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx - size * 0.26, cy + size * 0.4);
    g.quadraticCurveTo(cx - size * 0.26, cy - size * 0.06, cx, cy - size * 0.06);
    g.quadraticCurveTo(cx + size * 0.26, cy - size * 0.06, cx + size * 0.26, cy + size * 0.4);
    g.closePath();
    g.fill();
  }

  private drawPops(dt: number): void {
    const g = this.g;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life += dt;
      if (p.life > p.dur) {
        this.pops.splice(i, 1);
        continue;
      }
      const k = p.life / p.dur;
      const grow = 1 - Math.pow(1 - Math.min(1, k * 4), 2);
      // Yazı EKRANA SIĞDIRILIYOR. Bu balonlar önce sadece "+8" gibi kısa
      // sayılar taşıyordu ve sabit punto yetiyordu; silah adları gelince
      // "GREAT AXE" ekranın iki yanından taştı.
      const size = Math.min(this.L.w * 0.11, 52) * (1 + grow * 0.25) * p.k;
      g.save();
      g.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitFont(g, p.text, this.L.w * 0.82, '900', size, FONT);
      // `fitFont` yazı tipini kurdu ama küçültülmüş puntoyu döndürmüyor;
      // gölge ve kontur kalınlığı ona göre ölçekleneceği için font
      // dizisinden okunuyor. parseInt doğrudan çalışmıyor — dizi ağırlıkla
      // başlıyor ("900 42px ...") ve 900 döndürüyordu.
      const fitted = +(/(\d+)px/.exec(g.font) || [0, size])[1] || size;
      // Yükselme mesafesi ÖMÜRLE orantılı: kısa ömürlü kritik balonu, uzun
      // ömürlü kapı balonuyla aynı yolu gitseydi bir çırpıda yukarı fırlayıp
      // hedefin can sayısının üstüne oturuyordu.
      outlinedText(g, p.text, Math.max(fitted, Math.min(this.L.w - fitted, p.x)),
        p.y - k * this.L.h * 0.105 * p.dur, fitted, '#ffffff', p.color, 'rgba(20,26,34,.85)');
      g.restore();
    }
  }

  /**
   * Açılış geri sayımı: 3, 2, 1.
   *
   * Her sayı büyük gelip yerine oturuyor ve son çeyreğinde soluyor —
   * ekranda üç ayrı sayı değil, tek bir ritim okunuyor.
   *
   * YERİ BOŞ YOL. İlk denemede %36 yükseklikteydi ve tam ilk kapının
   * panellerine oturuyordu: geri sayım biterken oyuncunun okuması gereken
   * "+8 / −2" üç saniye boyunca kapalı kalıyordu. Kapı ile karakter
   * arasındaki boş asfalt, bu ekranda hiçbir şeyi örtmeyen tek yer.
   */
  private countdown(pre: number): void {
    const g = this.g;
    const L = this.L;
    const step = STRIKE.countIn / 3;
    const n = Math.min(3, Math.max(1, Math.ceil(pre / step)));
    const age = 1 - ((pre / step) % 1);
    const size = Math.min(L.w * 0.26, 132) * (1.35 - 0.35 * (1 - Math.pow(1 - Math.min(1, age * 3), 2)));
    g.save();
    g.globalAlpha = age < 0.72 ? 1 : Math.max(0, 1 - (age - 0.72) / 0.28);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 ' + Math.round(size) + 'px ' + FONT;
    outlinedText(g, String(n), L.w / 2, L.h * 0.53, size, '#ffffff', '#2CC8C0', 'rgba(10,20,34,.85)');
    g.restore();
  }

  /**
   * Patron can barı — sadece menzile girince.
   *
   * Bu birimde sayaç GÜCÜ ölçüyor, hedefi değil. Gate Crashers'ta duvarın
   * üstünde "NEED 24" yazıyordu ve oyuncu ne kadar geride olduğunu tek
   * bakışta görüyordu; burada o bilgi patronun canında. Barsız hâlinde
   * son on saniye kör bir bekleyişti: silahlar gidiyor, bir şey oluyor mu
   * belli değil. Bar, o on saniyeyi geri sayıma çeviriyor.
   *
   * Sadece menzilde çiziliyor — koşunun başında ekranda duran, dolu ve
   * hiç kıpırdamayan bir bar bilgi değil gürültü.
   */
  private bossBar(s: State): void {
    if (s.status !== 'playing') return;
    const bi = TRACK.length - 1;
    const bev = TRACK[bi];
    if (bev.type !== 'target') return;
    const ts = s.targets[bi];
    if (ts.broken) return;
    const d = bev.z - s.z;
    if (d > STRIKE.range + 8 || d < -2) return;
    const g = this.g;
    const L = this.L;
    const w = Math.min(L.w * 0.62, 300);
    const h = Math.max(13, L.h * 0.017);
    const x = (L.w - w) / 2;
    const y = Math.max(12, L.h * 0.024) + Math.min(Math.max(46, L.h * 0.062), 64) + h * 2.4;

    g.save();
    // Menzile girerken belirsin: anlık beliren bir bar sıçrama gibi okunuyor.
    g.globalAlpha = Math.max(0, Math.min(1, (STRIKE.range + 8 - d) / 6));
    g.fillStyle = 'rgba(20,28,24,.55)';
    roundRect(g, x, y, w, h, h / 2);
    g.fill();
    const p = Math.max(0, ts.hp / BOSS_HP);
    g.fillStyle = '#E5484D';
    roundRect(g, x, y, Math.max(h, w * p), h, h / 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 ' + Math.round(h * 0.72) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(COPY.need + '  ' + Math.ceil(ts.hp), L.w / 2, y + h / 2 + 0.5);
    g.restore();
  }

  /**
   * SİLAH KARTI — referanstaki "EQUIPPED" panelinin karşılığı.
   *
   * İki sayaçlı bir oyunda ikisi de ekranda olmak zorunda: üstteki çip kaç
   * ADAM olduğunu, bu kart bir vuruşun kaç HASAR verdiğini söylüyor. Kart
   * sağda ve dar, çünkü asıl okunacak şey hedefin üstündeki can; bu sayı
   * onun ne kadar ineceğini açıklayan dipnot.
   */
  private weaponCard(s: State): void {
    const g = this.g;
    const L = this.L;
    const w = Math.max(52, Math.min(L.w * 0.15, 72));
    const h = w * 1.12;
    const x = L.w - w - Math.max(10, L.w * 0.028);
    const y = Math.max(12, L.h * 0.024) + Math.min(Math.max(46, L.h * 0.062), 64) + h * 0.42;

    // Yükseldiği an büyüyüp yerine oturuyor — sessiz bir yükseltme fark
    // edilmiyordu.
    const pop = Math.max(0, 1 - this.wepPop);
    const k = 1 + pop * 0.28;
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.scale(k, k);
    g.translate(-w / 2, -h / 2);

    g.fillStyle = 'rgba(24,18,34,.78)';
    roundRect(g, 0, 0, w, h, w * 0.18);
    g.fill();
    g.strokeStyle = pop > 0 ? '#FFD45F' : 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    roundRect(g, 1, 1, w - 2, h - 2, w * 0.17);
    g.stroke();

    // Kartın başlığı silahın ADI: sadece sayı değişseydi yükseltme "5 oldu"
    // olurdu, adı da değişince "kılıç aldım" oluyor. İsimler farklı uzunlukta
    // olduğu için karta sığdırılıyor.
    g.fillStyle = 'rgba(255,255,255,.62)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, weaponName(s.weapon), w * 0.86, '800', w * 0.17, FONT);
    g.fillText(weaponName(s.weapon), w / 2, h * 0.17);

    // İkonun altına açık bir kuyu. Kart koyu, silahların gövdesi ahşap:
    // koyu üstüne koyu koyunca çift ağızlı baltadan geriye sadece iki çelik
    // parça kalıyordu. Kuyu her kademeyi aynı zeminde gösteriyor.
    g.fillStyle = 'rgba(255,255,255,.1)';
    roundRect(g, w * 0.16, h * 0.26, w * 0.68, h * 0.4, w * 0.1);
    g.fill();
    weaponIcon(g, w / 2, h * 0.46, w * 0.34, weaponTier(s.weapon));

    const num = String(s.weapon);
    const size = Math.round(w * 0.34);
    g.font = '900 ' + size + 'px ' + FONT;
    outlinedText(g, num, w / 2, h * 0.81, size, '#FFD45F', '#FF9F45', 'rgba(16,12,20,.9)');
    g.restore();
  }

  /** Tutorial: sağa sola giden el + iki ok. */
  /** Tutorial: sağa sola giden el + iki ok. */
  private swipeHint(): void {
    const g = this.g;
    const L = this.L;
    const cy = L.safeBottom - L.h * 0.1;
    const amp = Math.min(L.w * 0.17, 86);
    const p = (this.t % 2.0) / 2.0;
    const wave = Math.sin(p * Math.PI * 2);
    const x = L.w / 2 + wave * amp;
    const r = Math.min(L.w * 0.055, 26);

    g.save();
    for (const d of [-1, 1]) {
      const ax = L.w / 2 + d * (amp + r * 1.9);
      g.globalAlpha = 0.35 + (d * wave > 0 ? 0.5 : 0);
      g.fillStyle = '#12203A';
      g.strokeStyle = 'rgba(255,255,255,.75)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ax + d * r * 0.7, cy);
      g.lineTo(ax - d * r * 0.35, cy - r * 0.62);
      g.lineTo(ax - d * r * 0.35, cy + r * 0.62);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(18,32,58,.28)';
    g.beginPath();
    g.arc(x, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = Math.max(2, r * 0.16);
    g.stroke();
    g.restore();

    this.label(COPY.tutorial, cy + r * 2.1);
  }

  private label(text: string, y: number): void {
    const g = this.g;
    const L = this.L;
    const fs = Math.round(Math.min(Math.max(L.w * 0.042, 13), 22));
    g.font = '800 ' + fs + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pw = g.measureText(text).width + fs * 1.4;
    const ph = fs * 1.7;
    g.fillStyle = 'rgba(14,26,42,.76)';
    roundRect(g, L.w / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2);
    g.fill();
    outlinedText(g, text, L.w / 2, y, fs, '#ffffff', '#BEDCF6', 'rgba(8,16,28,.9)');
  }

  private soundBtn(): void {
    const g = this.g;
    const r = this.L.sound;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle = 'rgba(20,34,52,.32)';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();

    const u = r.w * 0.13;
    g.fillStyle = '#EAF3FF';
    g.beginPath();
    g.moveTo(cx - u * 1.5, cy - u * 0.6);
    g.lineTo(cx - u * 0.6, cy - u * 0.6);
    g.lineTo(cx + u * 0.4, cy - u * 1.6);
    g.lineTo(cx + u * 0.4, cy + u * 1.6);
    g.lineTo(cx - u * 0.6, cy + u * 0.6);
    g.lineTo(cx - u * 1.5, cy + u * 0.6);
    g.closePath();
    g.fill();

    g.strokeStyle = '#EAF3FF';
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

  private ctaButton(r: Rect, k: number): void {
    const g = this.g;
    const w = r.w * k;
    const h = r.h * k;
    const x = r.x + (r.w - w) / 2;
    const y = r.y + (r.h - h) / 2;
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, '#FF6A57');
    grd.addColorStop(1, '#D0231C');
    g.save();
    g.shadowColor = 'rgba(90,12,10,.45)';
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
      sg.addColorStop(0.5, 'rgba(255,255,255,.45)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg;
      g.fillRect(x, y, w, h);
      g.restore();
    }

    g.fillStyle = '#FFF2EE';
    g.font = '900 ' + Math.round(h * 0.42) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(COPY.cta, x + w / 2, y + h / 2);
  }

  private endcard(s: State): void {
    const g = this.g;
    const L = this.L;
    const won = s.status === 'won';
    const et = s.endT - STRIKE.endAfter;
    const celebrating = et < STRIKE.celebrateFor;

    g.fillStyle = celebrating ? 'rgba(12,22,38,.58)' : 'rgba(12,22,38,.9)';
    g.fillRect(0, 0, L.w, L.h);

    const cy = L.h * (celebrating ? 0.4 : 0.28);
    const size = Math.min(L.w * 0.3, L.h * 0.18);
    const pop = Math.min(1, et / 0.35);
    const k = (0.6 + 0.4 * this.ease(pop)) * (1 + Math.sin(this.t * 2.4) * 0.04);

    // Kapanış görseli: kalabalığın kendisi. Üç adam + büyük sayı.
    for (let i = 0; i < 3; i++) {
      this.person(L.w / 2 + (i - 1) * size * 0.42, cy, size * k * (i === 1 ? 1 : 0.82), '#FFFFFF');
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const numSize = Math.min(L.w * 0.16, 76);
    fitFont(g, String(s.crowd), L.w * 0.5, '900', numSize, FONT);
    outlinedText(g, String(s.crowd), L.w / 2, cy + size * 1.06, numSize,
      won ? '#B6F5EE' : '#FF8A8A', won ? '#22A9A2' : '#E5484D', 'rgba(8,16,28,.9)');

    const title = won ? COPY.win : COPY.lose;
    fitFont(g, title, L.w * 0.88, '900', Math.min(L.w * 0.085, 40), FONT);
    g.fillStyle = won ? '#B6F5EE' : '#ffffff';
    g.fillText(title, L.w / 2, cy + size * 1.06 + Math.min(L.w * 0.12, 58));

    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '600 ' + Math.round(Math.min(L.w * 0.045, 21)) + 'px ' + FONT;
    g.fillText(won ? s.crowd + ' ' + COPY.winSub : COPY.loseSub,
      L.w / 2, cy + size * 1.06 + Math.min(L.w * 0.19, 92));

    if (celebrating) return;

    const fade = Math.min(1, (et - STRIKE.celebrateFor) / 0.3);
    g.save();
    g.globalAlpha = fade;
    const by = L.h * 0.63;
    fitFont(g, COPY.brand, L.w * 0.84, '900', Math.min(L.w * 0.075, 34), FONT);
    g.fillStyle = '#B6F5EE';
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
