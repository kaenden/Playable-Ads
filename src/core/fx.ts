/**
 * Partikül / halka / sarsıntı — 2D context üzerine çiziliyor.
 *
 * 3D playable'da da bu kullanılıyor: efektler WebGL sahnesinin ÜSTÜNDEKİ
 * HUD canvas'ına çiziliyor. Sektörde yaygın pratik; 3D partikül sistemi
 * kurmak hem bundle'ı hem GPU'yu boşuna yoruyor.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

/** Roket ışını — açılıp sönen bir şerit. */
interface Beam {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  dur: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  max: number;
  life: number;
  dur: number;
  color: string;
}

export class Fx {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  shake = 0;

  /**
   * Rengi artık ÇAĞIRAN veriyor.
   *
   * Önceden seviye renk tablosunu art.ts'ten okuyordu; o yüzden Fx'i kullanan
   * her playable merge'in sprite üreticisini de bundle'ına alıyordu. Efekt
   * sistemi hangi oyunun içinde olduğunu bilmemeli.
   */
  burst(cx: number, cy: number, size: number, level: number, color: string): void {
    const n = 8 + level * 3;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = size * (0.9 + Math.random() * 1.4);
      this.parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - size * 0.4,
        life: 0,
        max: 0.45 + Math.random() * 0.35,
        size: size * (0.045 + Math.random() * 0.06),
        color,
      });
    }
    this.rings.push({ x: cx, y: cy, r0: size * 0.3, max: size * (1.1 + level * 0.18), life: 0, dur: 0.42, color });
    if (level >= 4) this.shake = size * 0.06;
  }

  /**
   * Küçük çarpma kıvılcımı — halkasız, az partiküllü.
   *
   * `burst` en az 11 partikül ve bir halka üretiyor; saniyede on dört vuruş
   * alan bir sahnede o, efekt değil sis oluyor. Bu sürüm tek bir vuruşun
   * "değdi" demesi için: dört kıvılcım, yukarı doğru, halka yok.
   */
  spark(cx: number, cy: number, size: number, color: string, n?: number): void {
    const k = n || 4;
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = size * (0.7 + Math.random());
      this.parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 0.22 + Math.random() * 0.18,
        size: size * (0.05 + Math.random() * 0.05),
        color,
      });
    }
  }

  /**
   * Işın — bir satırı ya da sütunu süpüren roketin izi.
   *
   * Enine doğru açılıp boyuna sönüyor: önce ince bir çizgi, sonra geniş
   * bir şerit, sonra yok. Partikülle yapılmıyor çünkü anlatması gereken
   * şey bir yön, bir bulut değil.
   */
  beam(x: number, y: number, w: number, h: number, color: string): void {
    this.beams.push({ x, y, w, h, life: 0, dur: 0.34, color });
  }

  /** Sarsıntı ofseti; renderer kendi transformunda uyguluyor. */
  shakeOffset(dt: number): [number, number] {
    if (this.shake <= 0.2) {
      this.shake = 0;
      return [0, 0];
    }
    const o: [number, number] = [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake];
    this.shake *= Math.pow(0.001, dt);
    return o;
  }

  draw(g: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life += dt;
      const p = b.life / b.dur;
      if (p >= 1) {
        this.beams.splice(i, 1);
        continue;
      }
      const grow = 1 - Math.pow(1 - p, 2);
      const bw = b.w > b.h ? b.w : b.w * (0.25 + grow * 1.1);
      const bh = b.h > b.w ? b.h : b.h * (0.25 + grow * 1.1);
      g.globalAlpha = (1 - p) * 0.85;
      g.fillStyle = b.color;
      g.fillRect(b.x - bw / 2, b.y - bh / 2, bw, bh);
    }
    g.globalAlpha = 1;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const p = r.life / r.dur;
      if (p >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const rad = r.r0 + (r.max - r.r0) * (1 - Math.pow(1 - p, 3));
      g.globalAlpha = (1 - p) * 0.75;
      g.strokeStyle = r.color;
      g.lineWidth = Math.max(1.5, r.max * 0.09 * (1 - p));
      g.beginPath();
      g.arc(r.x, r.y, rad, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.globalAlpha = 1 - p.life / p.max;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
