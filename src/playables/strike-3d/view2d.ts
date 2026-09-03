/**
 * WebGL'siz yedek görünüm.
 *
 * Kural (merge-3d'den beri): WebGL yoksa BOŞ EKRAN gösterilemez. Bazı ad
 * container'ları hâlâ WebGL'siz çalışıyor; orada `new WebGLRenderer()`
 * patlıyor ve reklam beyaz kalıyor — CTA hiç görünmüyor, gösterim yanıyor.
 *
 * Bu görünüm oyunu YUKARIDAN gösteriyor: aynı durum, aynı HUD, aynı kontrol.
 * Güzel değil ama oynanabilir ve CTA yerinde. Runner'ın bütün bilgisi zaten
 * iki sayıda: kalabalık nerede duruyor ve önünde ne var.
 */
import { STRIKE, TRACK, GATE_COLOR, opLabel, opGood } from './config';
import { State } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { Fx } from '../../core/fx';
import { RunView } from './view';
import {  } from '../../core/draw';

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
/** Kaç birim ileri görünüyor. */
const AHEAD = 34;

export class View2D implements RunView {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private g: CanvasRenderingContext2D;
  private t = 0;

  constructor(gl: HTMLCanvasElement) {
    // WebGL canvas'ı kullanılmıyor; ekranda yer kaplamasın.
    gl.style.display = 'none';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(cv);
    this.cv = cv;
    this.g = cv.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background = 'linear-gradient(180deg,#FFCE8C 0%,#FFF0DA 100%)';
    this.hud = new Hud(this.g, this.L);
    this.resize();
  }

  resize(): void {
    this.L.update();
    const { w, h, dpr } = this.L;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Kalabalığın ekrandaki y'si — 3D'dekiyle aynı yerde dursun. */
  private baseY(): number {
    return this.L.safeBottom - this.L.h * 0.16;
  }

  private scale(): number {
    return (this.baseY() - this.L.headerBottom) / AHEAD;
  }

  private sx(worldX: number, camX: number): number {
    const px = (this.L.w * 0.82) / (STRIKE.halfW * 2);
    return this.L.w / 2 + (worldX - camX) * px;
  }

  private sy(worldZ: number, camZ: number): number {
    return this.baseY() - (worldZ - camZ) * this.scale();
  }

  gate(good: boolean, label: string): void {
    const y = this.baseY();
    this.hud.pop(this.L.w / 2, y, label, good ? GATE_COLOR.good : GATE_COLOR.bad);
  }

  hurt(n: number): void {
    this.hud.pop(this.L.w / 2, this.baseY(), '−' + n, GATE_COLOR.bad);
    this.fx.shake = this.L.w * 0.04;
  }

  kill(): void {
    /* 2D yedekte ölüm efekti yok: yedeğin işi oyunu OYNANIR tutmak,
       gösteriyi eşitlemek değil. */
  }

  finish(): void {
    /* 2D yedekte ayrı bir yıkım animasyonu yok. */
  }

  reset(): void {
    this.hud.reset();
  }

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;
    const g = this.g;
    const L = this.L;
    const camX = s.x * 0.55;

    g.clearRect(0, 0, L.w, L.h);
    const [shx, shy] = this.fx.shakeOffset(dt);
    g.save();
    g.translate(shx * 0.35, shy * 0.35);

    // Zemin ve patika.
    g.fillStyle = '#2E9C86';
    g.fillRect(0, 0, L.w, L.h);
    const px = (L.w * 0.82) / (STRIKE.halfW * 2);
    g.fillStyle = '#F0D9A8';
    g.fillRect(this.sx(-STRIKE.halfW, camX), 0, STRIKE.halfW * 2 * px, L.h);

    // İlerleme çizgileri: hız hissi.
    g.strokeStyle = 'rgba(216,184,126,.7)';
    g.lineWidth = 3;
    for (let z = Math.floor(s.z / 4) * 4; z < s.z + AHEAD; z += 4) {
      const y = this.sy(z, s.z);
      g.beginPath();
      g.moveTo(this.sx(-STRIKE.halfW, camX), y);
      g.lineTo(this.sx(STRIKE.halfW, camX), y);
      g.stroke();
    }

    for (const ev of TRACK) {
      if (ev.z < s.z - 3 || ev.z > s.z + AHEAD) continue;
      const y = this.sy(ev.z, s.z);
      if (ev.type === 'gate') {
        for (const side of [-1, 1]) {
          const op = side < 0 ? ev.left : ev.right;
          const x0 = this.sx(side < 0 ? -STRIKE.halfW : 0, camX);
          const wdt = STRIKE.halfW * px;
          g.fillStyle = opGood(op) ? GATE_COLOR.good : GATE_COLOR.bad;
          g.globalAlpha = 0.85;
          g.fillRect(x0, y - 26, wdt, 52);
          g.globalAlpha = 1;
          g.fillStyle = '#fff';
          g.font = '900 26px ' + FONT;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(opLabel(op), x0 + wdt / 2, y);
        }
      } else if (ev.type === 'boss') {
        // Patron: tek dev daire. Düşman grupları burada çizilmiyor, çünkü
        // onlar parkurun bir parçası değil DURUMUN bir parçası — canları
        // değişiyor ve aşağıda tek tek çiziliyorlar.
        if (s.bossHp > 0) {
          const br = Math.max(22, L.w * 0.07);
          g.fillStyle = '#B33A3A';
          g.beginPath();
          g.arc(L.w / 2, y - br * 0.5, br, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    // Düşmanlar — 3D'dekiyle AYNI konumlar, aynı durumdan.
    const r = Math.max(7, L.w * 0.022);
    for (const f of s.foes) {
      if (f.hp <= 0) continue;
      if (f.z < s.z - 2 || f.z > s.z + 58) continue;
      const x = this.sx(f.x, camX);
      const y = this.sy(f.z, s.z);
      g.fillStyle = '#B33A3A';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // Havadaki silahlar.
    g.fillStyle = '#E9EEF5';
    for (const sh of s.shots) {
      const x = this.sx(sh.x, camX);
      const y = this.sy(sh.z, s.z);
      g.fillRect(x - 5, y - 2, 10, 4);
    }

    // Oyuncu.
    const px0 = this.sx(s.x, camX);
    const py0 = this.sy(s.z, s.z);
    g.fillStyle = 'rgba(18,42,36,.25)';
    g.beginPath();
    g.ellipse(px0, py0 + r * 0.9, r * 1.3, r * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1E2430';
    g.beginPath();
    g.arc(px0, py0, r * 1.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#F6D1A5';
    g.beginPath();
    g.arc(px0, py0 - r * 0.55, r * 0.58, 0, Math.PI * 2);
    g.fill();
    g.restore();

    this.fx.draw(g, dt);
    this.hud.draw(s, ui, dt);
  }
}
