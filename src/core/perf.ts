/**
 * Cihaz ölçüm göstergesi — SADECE preview build'inde.
 * `__AD_NETWORK__` derleme zamanı sabiti olduğu için ağ paketlerinde
 * bu dosyanın tamamı dead-code olarak siliniyor.
 */

const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';

class Perf {
  private acc = 0;
  private frames = 0;
  private elapsed = 0;
  private worst = 999;
  fps = 0;

  /**
   * Script'in çalışmaya başladığı an — HTML indirme + parse + inline bundle parse.
   * Modül değerlendirmesi sırasında yakalanıyor.
   */
  readonly evalMs = Math.round(performance.now());

  /**
   * İLK KARENİN ÇİZİLDİĞİ an. İlk versiyonda bu değeri de modül yüklenirken
   * alıyordum; init ve ilk render'ı hiç kapsamıyordu ve 21 KB'lık 2D ile
   * 570 KB'lık 3D build aynı sayıyı veriyordu. Artık gerçekten ilk frame'de set ediliyor.
   */
  firstFrameMs = 0;

  /**
   * Ölçüm rozeti. Ekran düzeni sınıfının tipini değil, ihtiyacı olan tek alanı
   * istiyor: her playable'ın kendi düzen sınıfı var, perf hiçbirine bağlanmamalı.
   */
  frame(dt: number, g: CanvasRenderingContext2D, L: { w: number }): void {
    if (!this.firstFrameMs) this.firstFrameMs = Math.round(performance.now());
    this.acc += dt;
    this.frames++;
    this.elapsed += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      // ilk 2 saniyeyi sayma: açılış jank'i gerçek performansı temsil etmiyor
      if (this.elapsed > 2 && this.fps < this.worst) this.worst = this.fps;
      this.acc = 0;
      this.frames = 0;
    }

    const pad = Math.max(8, L.w * 0.02);
    const fs = Math.max(11, Math.min(L.w * 0.032, 15));
    const line1 = this.fps + ' FPS' + (this.worst < 999 ? '  (min ' + this.worst + ')' : '');
    const line2 = 'ilk kare ' + this.firstFrameMs + ' ms  (parse ' + this.evalMs + ')';

    g.font = '700 ' + fs + 'px ' + FONT;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const w = Math.max(g.measureText(line1).width, g.measureText(line2).width) + fs * 1.2;
    const h = fs * 3.1;

    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(pad, pad, w, h);
    g.fillStyle = this.fps >= 50 ? '#5fe0a0' : this.fps >= 30 ? '#ffd45f' : '#ff6b6b';
    g.fillText(line1, pad + fs * 0.6, pad + fs * 0.45);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.font = '600 ' + fs * 0.85 + 'px ' + FONT;
    g.fillText(line2, pad + fs * 0.6, pad + fs * 1.75);
  }
}

/**
 * Modül seviyesinde koşulsuz `new Perf()` yazınca esbuild yan etkili sayıp
 * sınıfı ağ paketlerinden ELEYEMİYORDU — çağrı ölüyordu ama kod duruyordu.
 * Ternary sabite katlanınca non-preview build'lerde `null` kalıyor,
 * Perf sınıfı referanssız kalıyor ve tree-shaking onu atıyor.
 */
export const perf = (__AD_NETWORK__ === 'preview' ? new Perf() : null) as Perf;
