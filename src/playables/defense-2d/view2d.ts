/**
 * 2D renderer. Bütün yüzeyler asset paketinden geliyor.
 *
 * İki karar açıklama istiyor:
 *
 * 1. YOL NEDEN KAROLARDAN DEĞİL. Kenney'nin terrain setti bir "bölge"
 *    tileset'i: geniş organik alanların kenar ve köşe parçalarını veriyor
 *    (kendi Sample.png'sinde de öyle kullanılmış). Tek karo genişliğinde
 *    kıvrılan bir yol için gereken 16 parçalık auto-tile seti pakette YOK.
 *    Bu yüzden yolun SİLUETİ kodla çiziliyor (yuvarlak uçlu kalın çizgi) ve
 *    içi paketin kendi toprak karosuyla DOLDURULUYOR. Sanat yine müşterinin;
 *    değişen tek şey düzen. Gerçek işte de olan bu: paket neye izin veriyorsa
 *    layout ona uyar, sanat yönü esnetilmez.
 *
 * 2. STATİK KATMAN AYRI CANVAS'TA. Çim + yol + dekor her karede yeniden
 *    çizilseydi karo başına drawImage ile 60 çağrı ederdik. Bunlar sadece
 *    resize'da değişiyor; bir kez offscreen canvas'a çizilip her karede tek
 *    drawImage ile basılıyor.
 */
import { TD, WAY, SLOTS, FOES } from './config';
import { State, pointAt } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { Fx } from '../../core/fx';
import { draw as sprite, pattern, ready } from './atlas';

/** Sprite'ın kendi yönü: paket tutarlı değil, kule ve piyade yukarı bakıyor,
 *  tank sağa. Açı hesabı 0 = sağ olduğu için yukarı bakanlara +90° ekleniyor. */
const FACE_UP: Record<string, boolean> = {
  tower1: true,
  tower2: true,
  tower3: true,
  foe1: true,
  foe2: true,
  foe3: true,
  tank: false,
  missile: true,
};

/** Dekor: [sprite, hücre x, hücre y, ölçek]. Sabit — reklamda rastgelelik yok. */
const DECOR: Array<[string, number, number, number]> = [
  ['tree', 0.45, 0.5, 1.0],
  ['bush', 3.5, 0.55, 0.85],
  ['rock1', 5.4, 1.3, 0.7],
  ['palm', 0.5, 3.4, 0.95],
  ['bushS', 2.6, 2.9, 0.6],
  ['plant', 5.5, 6.2, 0.75],
  ['tree', 4.5, 6.6, 0.95],
  ['rock2', 0.5, 9.3, 0.8],
  ['bush', 2.5, 9.4, 0.85],
  ['bushS', 3.4, 4.2, 0.55],
  ['rock1', 5.5, 8.6, 0.7],
  ['plant', 0.5, 1.4, 0.6],
];

export class View2D {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private bgG: CanvasRenderingContext2D;
  private t = 0;
  private wonFired = false;

  constructor(cv: HTMLCanvasElement) {
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    this.cv = cv;
    this.g = cv.getContext('2d') as CanvasRenderingContext2D;
    this.bg = document.createElement('canvas');
    this.bgG = this.bg.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = '#4CAF50';
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    const { w, h, dpr } = this.L;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bg.width = this.cv.width;
    this.bg.height = this.cv.height;
    this.bgG.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintStatic();
  }

  /** Çim + yol + dekor. Sadece resize'da çalışıyor. */
  private paintStatic(): void {
    const g = this.bgG;
    const L = this.L;
    g.clearRect(0, 0, L.w, L.h);
    if (!ready()) return;

    // --- çim: ekranın tamamı, tahtanın dışı da dahil
    const grass = pattern(g, 'grass', L.cell);
    if (grass) {
      g.save();
      g.translate(L.board.x, L.board.y);
      g.fillStyle = grass;
      g.fillRect(-L.board.x, -L.board.y, L.w, L.h);
      g.restore();
    } else {
      g.fillStyle = '#4CAF50';
      g.fillRect(0, 0, L.w, L.h);
    }

    // --- yol
    //
    // Toprak dolgusu AYRI bir canvas'ta üretiliyor. İlk sürüm yolu doğrudan
    // arka plana çizip `source-atop` ile toprak deseni basıyordu: çim zaten
    // tuvalin tamamını opak kapladığı için desen HER YERE gitti ve ekran
    // baştan aşağı toprak oldu. `clip()` de çare değil — Path2D'nin clip'i
    // dolgu bölgesini alıyor, bizim yol ise KALIN BİR ÇİZGİ.
    //
    // Şeffaf bir katmana çizgiyi çizip `source-in` ile deseni içine hapsetmek
    // doğru yol: dışarısı şeffaf kalıyor, sonra tek drawImage ile birleşiyor.
    const road = new Path2D();
    for (let i = 0; i < WAY.length; i++) {
      const [x, y] = L.px(WAY[i][0] + 0.5, WAY[i][1] + 0.5);
      if (i === 0) road.moveTo(x, y);
      else road.lineTo(x, y);
    }

    const rc = document.createElement('canvas');
    rc.width = this.bg.width;
    rc.height = this.bg.height;
    const rg = rc.getContext('2d') as CanvasRenderingContext2D;
    rg.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    rg.lineCap = 'round';
    rg.lineJoin = 'round';
    rg.strokeStyle = '#000000';
    rg.lineWidth = L.cell * 0.94;
    rg.stroke(road);
    rg.globalCompositeOperation = 'source-in';
    const dirt = pattern(rg, 'dirt', L.cell);
    rg.fillStyle = dirt || '#8b5a2b';
    rg.save();
    rg.translate(L.board.x, L.board.y);
    rg.fillRect(-L.board.x, -L.board.y, L.w, L.h);
    rg.restore();

    // Kenar hattı: paketin karo kenarlarındaki koyu çim sınırını taklit ediyor.
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(48,104,44,.75)';
    g.lineWidth = L.cell * 1.04;
    g.stroke(road);
    g.restore();
    g.drawImage(rc, 0, 0, L.w, L.h);

    // --- dekor
    //
    // Altlarına yumuşak gölge: paketin bitki sprite'ları YEŞİL ve zemin de
    // yeşil, gölgesiz hâlde çime karışıp kayboluyorlardı. Gölge sanatı
    // değiştirmiyor, sadece zeminden ayırıyor.
    for (const [name, cx, cy, sc] of DECOR) {
      const [x, y] = L.px(cx, cy);
      const r = L.cell * sc * 0.3;
      g.save();
      g.fillStyle = 'rgba(24,60,26,.22)';
      g.beginPath();
      g.ellipse(x, y + r * 0.55, r, r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      sprite(g, name, x, y, L.cell * sc);
    }
  }

  /** Yuvanın ekran merkezi — tutorial halkası oraya. */
  slotPos(i: number): [number, number] {
    const s = SLOTS[i];
    return this.L.px(s[0] + 0.5, s[1] + 0.5);
  }

  burstAt(cx: number, cy: number, color: string, power: number): void {
    const [x, y] = this.L.px(cx, cy);
    this.fx.burst(x, y, this.L.cell * 0.55, power, color);
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
    g.drawImage(this.bg, 0, 0, L.w, L.h);

    // --- kule yuvaları
    for (let i = 0; i < SLOTS.length; i++) {
      const taken = s.towers.some((t) => t.slot === i);
      if (taken) continue;
      const [x, y] = this.slotPos(i);
      const afford = s.cash >= TD.towerCost && s.status === 'playing';
      // Parası yetmeyen yuva soluyor: "neden olmuyor" sorusu ekranda cevaplı.
      g.globalAlpha = afford ? 0.85 + Math.sin(this.t * 3.4) * 0.15 : 0.34;
      sprite(g, 'slot', x, y, c);
      g.globalAlpha = 1;
      if (ui.deny === i && ui.denyT > 0) {
        g.strokeStyle = 'rgba(232,68,58,' + Math.min(1, ui.denyT * 3) + ')';
        g.lineWidth = Math.max(2, c * 0.05);
        g.beginPath();
        g.arc(x, y, c * 0.44, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // --- kuleler (menzil halkası sadece yeni kurulanda kısa süre)
    for (const tw of s.towers) {
      const sl = SLOTS[tw.slot];
      const [x, y] = L.px(sl[0] + 0.5, sl[1] + 0.5);
      const rot = tw.aim + (FACE_UP.tower1 ? Math.PI / 2 : 0);
      sprite(g, 'slot', x, y, c);
      g.save();
      g.shadowColor = 'rgba(12,30,16,.45)';
      g.shadowBlur = c * 0.16;
      g.shadowOffsetY = c * 0.05;
      sprite(g, 'tower1', x, y, c * 1.06, rot);
      g.restore();
      if (tw.flash > 0) {
        // Namlu ateşi namlunun UCUNDA, kulenin ortasında değil.
        const d = c * 0.46;
        sprite(g, 'flame1', x + Math.cos(tw.aim) * d, y + Math.sin(tw.aim) * d, c * 0.44, rot);
      }
    }

    // --- düşmanlar
    for (const f of s.foes) {
      const k = FOES[f.kind];
      const p = pointAt(f.dist);
      const [x, y] = L.px(p.x + 0.5, p.y + 0.5);
      const rot = p.a + (FACE_UP[k.sprite] ? Math.PI / 2 : 0);
      g.save();
      if (f.hit > 0) {
        // Vurulma parlaması: beyaz gölge, sprite'ı boyamadan öne çıkarıyor.
        g.shadowColor = '#ffffff';
        g.shadowBlur = c * 0.35;
      } else {
        g.shadowColor = 'rgba(12,30,16,.4)';
        g.shadowBlur = c * 0.1;
        g.shadowOffsetY = c * 0.04;
      }
      sprite(g, k.sprite, x, y, c * k.scale, rot);
      g.restore();

      // Can barı sadece HASAR ALMIŞ olanda: 14 düşmanın hepsine bar koymak
      // ekranı çöpe çeviriyordu.
      if (f.hp < f.maxHp) {
        const bw = c * 0.5;
        const bh = Math.max(3, c * 0.055);
        const bx = x - bw / 2;
        const by = y - c * k.scale * 0.62;
        g.fillStyle = 'rgba(10,20,14,.6)';
        g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#7CE07C';
        g.fillRect(bx, by, bw * (f.hp / f.maxHp), bh);
      }
    }

    // --- mermiler
    for (const b of s.bullets) {
      const [x, y] = L.px(b.x + 0.5, b.y + 0.5);
      sprite(g, 'bullet', x, y, c * 0.26);
    }

    this.fx.draw(g, dt);
    g.restore();

    if (s.status === 'won' && !this.wonFired) {
      this.wonFired = true;
      for (let i = 0; i < 8; i++) {
        this.fx.burst(
          L.w * (0.18 + Math.random() * 0.64),
          L.h * (0.22 + Math.random() * 0.3),
          Math.max(24, L.w * 0.055),
          3,
          ['#FFD45F', '#7CE07C', '#57E08A', '#E8443A', '#8FD3F7'][i % 5]
        );
      }
    } else if (s.status === 'playing') {
      this.wonFired = false;
    }

    const hp = ui.hint >= 0 ? this.slotPos(ui.hint) : null;
    this.hud.draw(s, ui, dt, hp);
  }
}
