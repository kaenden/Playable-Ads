/**
 * Ekran geometrisi.
 *
 * Merge'in layout'undan ayrı bir dosya: orada tahta ekran düzleminde duruyordu,
 * burada sahne EĞİK. Ortak bir "cellRect" ikisine birden hizmet edemez —
 * 3D görünüm hücreyi ışın atarak buluyor, 2D yedek dikdörtgenle.
 *
 * Bu dosyanın 3D'ye tek borcu `board`: kamera, otoparkı TAM olarak o
 * dikdörtgenin içine oturtuyor. Böylece HUD ile sahne hiçbir ekran oranında
 * çakışmıyor.
 */
import { LOT } from './config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  /** Tutorial elinin gösterdiği araç id'si; 0 = ipucu yok. */
  hint: number;
  /** Basılı tutulan hücre — dokunma geri bildirimi için. */
  press: number;
}

export class Layout {
  w = 0;
  h = 0;
  dpr = 1;
  /** Sahnenin oturacağı alan. */
  board: Rect = { x: 0, y: 0, w: 0, h: 0 };
  cta: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Kapanış kartındaki TRY AGAIN. */
  secondary: Rect = { x: 0, y: 0, w: 0, h: 0 };
  sound: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Üst bilgi bloğunun bittiği y — sahne bunun altından başlıyor. */
  headerBottom = 0;
  /**
   * Sahnenin ekranda GERÇEKTEN kapladığı yer — renderer dolduruyor.
   *
   * `board` sahneye ayrılan alan, `scene` ise içine oturan izdüşümün kendisi.
   * İkisi aynı değil: izometrik ada karenin tamamını doldurmuyor ve aradaki
   * fark tam olarak tutorial etiketinin oturması gereken boşluk. Etiketi
   * board'a göre koymak onu adadan kopuk bırakıyordu.
   */
  scene: Rect = { x: 0, y: 0, w: 0, h: 0 };

  update(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    this.w = w;
    this.h = h;
    this.dpr = dpr;

    const pad = Math.max(12, h * 0.028);
    const ctaH = Math.min(Math.max(52, h * 0.075), 72);
    const ctaW = Math.min(w * 0.86, 440);
    this.cta = { x: (w - ctaW) / 2, y: h - ctaH - pad, w: ctaW, h: ctaH };

    const sh = Math.min(Math.max(38, h * 0.05), 50);
    const sw = Math.min(w * 0.54, 250);
    this.secondary = { x: (w - sw) / 2, y: this.cta.y - sh - pad * 0.55, w: sw, h: sh };

    const sd = Math.min(Math.max(34, h * 0.045), 44);
    this.sound = { x: w - sd - Math.max(12, w * 0.035), y: Math.max(12, h * 0.022), w: sd, h: sd };

    // Başlık çipi + süre barı + etiket.
    this.headerBottom = Math.min(Math.max(96, h * 0.17), 168);

    // Sahne alanı: başlıkla CTA arası. Kare değil — izometrik otopark
    // yatayda daha geniş yer kaplıyor, kareye sıkıştırmak boşuna küçültürdü.
    const top = this.headerBottom;
    const bottom = this.secondary.y - pad * 0.5;
    this.board = { x: w * 0.012, y: top, w: w * 0.976, h: Math.max(120, bottom - top) };
    // Renderer henüz konuşmadıysa makul bir varsayılan.
    this.scene = { ...this.board };
  }

  /** 2D yedek görünümün hücre dikdörtgeni. 3D bunu KULLANMIYOR. */
  cellRect(i: number): Rect {
    const g = this.gridRect();
    const cw = g.w / LOT.cols;
    const ch = g.h / LOT.rows;
    return { x: g.x + (i % LOT.cols) * cw, y: g.y + (((i / LOT.cols) | 0) * ch), w: cw, h: ch };
  }

  /** 2D yedek: board içine oturan kare ızgara. */
  gridRect(): Rect {
    const size = Math.min(this.board.w, this.board.h) * 0.94;
    return {
      x: this.board.x + (this.board.w - size) / 2,
      y: this.board.y + (this.board.h - size) / 2,
      w: size,
      h: size,
    };
  }

  cellAt(x: number, y: number): number {
    const g = this.gridRect();
    const c = Math.floor(((x - g.x) / g.w) * LOT.cols);
    const r = Math.floor(((y - g.y) / g.h) * LOT.rows);
    if (c < 0 || r < 0 || c >= LOT.cols || r >= LOT.rows) return -1;
    return r * LOT.cols + c;
  }

  inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
