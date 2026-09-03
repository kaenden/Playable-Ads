/**
 * Atmosfer katmanı — sahnenin üstüne, arayüzün altına.
 *
 * NEDEN BURADA. İki işi sahnenin içinde yapmak zor, üstünde kolay: bakışı
 * ortada tutan hafif bir vinyet, ve CTA butonunun oturduğu şeritte yazının
 * okunmasını sağlayan bir perde.
 *
 * DENEYİP VAZGEÇTİĞİM ŞEY: renk düzeltmesini de buraya koymak. Sinema
 * işlerinde standart olan "üste sıcak alta soğuk" katmanı bu görüntüyü
 * SOLDURDU. Sebebi basit: bu katman sahneyle çarpılamıyor, sadece üstüne
 * saydam boya sürüyor — ve saydam boya her zaman doygunluk düşürür.
 * Hypercasual görüntünün istediği şey ise yüksek doygunluk. Renk artık
 * ışıkta ve malzemede ayarlanıyor.
 *
 * Zaten WebGL'in üstünde bir 2D katmanımız var (HUD). Bu katman oraya, ama
 * yazıların ALTINA çiziliyor — yoksa arayüz de kararır.
 *
 * HER KARE YENİDEN ÇİZİLMİYOR. Vinyet ve gradyanlar ekran boyu değişmedikçe
 * sabit; bir kez ayrı bir tuvale pişiriliyor, sonra her kare tek `drawImage`
 * ile basılıyor. Radyal gradyanı 60 kez saniyede doldurmak telefonda birkaç
 * milisaniye yiyor, kopyalamak yemiyor. defense-2d'nin zemin katmanında da
 * aynı yöntem var.
 */
export class Grade {
  private layer: HTMLCanvasElement | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** Kapıdan geçince kısa bir aydınlanma. */
  private flash = 0;
  private flashColor = '#ffffff';

  /**
   * Ekran boyu değiştiğinde katman yeniden pişiriliyor.
   *
   * CİHAZ PİKSELİNDE pişiyor, CSS pikselinde değil. İlk sürüm CSS boyunda
   * pişirip her kare 2 katına ölçekleyerek basıyordu: 1.4 milyon pikselin
   * yumuşatılarak kopyalanması kare hızını 108'den 54'e düşürdü. Aynı
   * çözünürlükte basınca kopyalama neredeyse bedava.
   */
  resize(w: number, h: number, dpr: number): void {
    if (this.w === w && this.h === h && this.dpr === dpr && this.layer) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    g.scale(dpr, dpr);

    // TON KATMANI YOK.
    //
    // İlk denemede üste sıcak alta soğuk bir renk katmanı koydum — sinema
    // işlerinde işe yarayan şey. Burada TERS tepti: ekranın üstüne düşük
    // saydamlıkta gri-mavi bir tabaka koymak doygunluğu düşürüyor, sahne
    // solgunlaşıyor. Hypercasual görüntü tam tersini istiyor: yüksek
    // doygunluk, yüksek kontrast, temiz renk.
    //
    // Bu katmanda artık sadece İŞLEVSEL iki şey var: bakışı ortada tutan
    // hafif bir vinyet ve butonun okunmasını sağlayan alt perde. Renk
    // düzeltmesi sahnenin KENDİSİNDE yapılıyor — ışıkta ve malzemede.

    // 1) Vinyet — sadece köşeler, ve gri değil KOYU YEŞİL-MAVİ. Gri bir
    //    karartma sahneyi soldurur; sahnenin kendi renginden koyu bir ton
    //    karartırken doygunluğu koruyor.
    const r = Math.hypot(w, h) * 0.66;
    const vig = g.createRadialGradient(w / 2, h * 0.5, r * 0.5, w / 2, h * 0.5, r);
    vig.addColorStop(0, 'rgba(10,44,52,0)');
    vig.addColorStop(0.74, 'rgba(10,44,52,.05)');
    vig.addColorStop(1, 'rgba(10,44,52,.26)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    // 2) Alt perde — CTA ve tutorial yazısının oturduğu şerit. Kalabalığın
    //    üstüne taşmıyor: en alttaki %16'da başlıyor.
    const scrim = g.createLinearGradient(0, h * 0.84, 0, h);
    scrim.addColorStop(0, 'rgba(12,30,34,0)');
    scrim.addColorStop(1, 'rgba(12,30,34,.30)');
    g.fillStyle = scrim;
    g.fillRect(0, h * 0.84, w, h * 0.16);

    this.layer = cv;
  }

  /** Kapı geçişi gibi anlarda tek karelik aydınlanma. */
  pulse(color: string): void {
    this.flash = 1;
    this.flashColor = color;
  }

  draw(g: CanvasRenderingContext2D, dt: number): void {
    if (this.layer) {
      // Dönüşümü sıfırla: katman zaten cihaz pikselinde, 1:1 basılmalı.
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.layer, 0, 0);
      g.restore();
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5.5);
      g.save();
      g.globalAlpha = this.flash * 0.28;
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, this.w, this.h);
      g.restore();
    }
  }
}
