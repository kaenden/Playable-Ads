/** Tek yerden ayarlanan playable parametreleri. UA ekibi bunları A/B test eder. */
export const GAME = {
  cols: 4,
  rows: 4,
  maxLevel: 5,
  /** Kazanma koşulu: bu seviyeye ulaş (5 = Dragon). Seed 4 merge ile ulaşılacak şekilde kurulu. */
  goalLevel: 5,
  /**
   * Fail-hook artık geri sayım değil HAMLE BÜTÇESİ.
   * Referans match-3 "4 hamlede kazanamazsın" diyordu; hamle sayacı geri
   * sayımdan daha okunur ve kaybı saatin değil oyuncunun kararı yapıyor.
   * Kazanmak tam 4 merge sürüyor, 8 hamle rahat pay bırakıyor.
   */
  moveBudget: 8,
  /** Ekstra level-1 yumurta hakkı. */
  spawnCharges: 5,
  /** Bu kadar saniye dokunulmazsa tutorial eli tekrar belirir. */
  idleHintAfter: 2.2,
  /** TikTok önerisi: 10sn hareketsizlikte sahneyi ilerlet. */
  autoAdvanceAfter: 10,
  /** Kutlama sahnesi bu kadar sürüyor, sonra marka + CTA kartı geliyor. */
  celebrateFor: 1.7,
};

/** Store hedefleri — build sırasında define ile ezilir, burası fallback. */
export const COPY = {
  title: 'Merge Dragons — Playable',
  goal: 'WAKE THE DRAGON',
  tutorial: 'DRAG TO MERGE',
  cta: 'PLAY NOW',
  win: 'DRAGON AWAKENED!',
  lose: 'SO CLOSE!',
  loseSub: 'The dragon is still sleeping',
  winSub: 'in',
  brand: 'MERGE DRAGONS',
  tagline: 'Hatch. Merge. Rule the sky.',
  again: 'TRY AGAIN',
  moves: 'MOVES',
};
