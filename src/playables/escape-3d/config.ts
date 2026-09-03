/** Üçüncü playable'ın ayarları. Merge'inkinden ayrı: iki oyun aynı sabitleri paylaşmamalı. */
export const LOT = {
  cols: 5,
  rows: 5,

  /**
   * FAIL-HOOK BURADA GERİ SAYIM, MERGE'DE HAMLE BÜTÇESİ.
   *
   * Bu bir tutarsızlık değil, kuralın kendisi: sayaç, HATANIN YAŞADIĞI YERİ
   * ölçmeli. Merge'de yanlış bırakma bir KARAR, o yüzden kararlar sayılıyor.
   * Burada tıkalı bir arabaya dokunmak karar değil, BİLGİ TOPLAMA — oyuncu
   * zaten hangi aracın kimi kilitlediğini böyle öğreniyor. Onu cezalandıran
   * bir bütçe, oyuncuya oyunu öğrenmeyi yasaklardı. Baskı başka yerden,
   * saatten gelmek zorunda.
   */
  timeLimit: 20,

  /** Bu kadar saniye dokunulmazsa tutorial eli tekrar belirir. */
  idleHintAfter: 2.2,
  /** TikTok önerisi: 10sn hareketsizlikte sahneyi kendi ilerlet. */
  autoAdvanceAfter: 10,
  /** Kutlama sahnesi bu kadar sürüyor, sonra marka + CTA kartı geliyor. */
  celebrateFor: 1.7,
  /** Araç çıkış animasyonu. */
  driveFor: 0.52,
  /** Tıkalı araç sarsıntısı. */
  bumpFor: 0.3,
};

export const COPY = {
  title: 'Traffic Escape — Playable',
  goal: 'CLEAR THE LOT',
  tutorial: 'TAP A CAR TO DRIVE OUT',
  cta: 'PLAY NOW',
  win: 'LOT CLEARED!',
  winSub: 'with',
  lose: "TIME'S UP!",
  loseSub: 'The lot is still jammed',
  brand: 'TRAFFIC ESCAPE',
  tagline: 'Tap. Unjam. Escape.',
  again: 'TRY AGAIN',
  left: 'CARS LEFT',
};
