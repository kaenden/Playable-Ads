/** Dördüncü playable — gerçek zamanlı kule savunma, müşteri asset'iyle. */
export const TD = {
  cols: 6,
  rows: 10,

  /**
   * ÜÇÜNCÜ FARKLI FAIL-HOOK: CAN.
   *
   * Merge hamle sayıyor (yanlış bırakma bir karardır), escape saniye sayıyor
   * (tıkalı araca dokunmak karar değil, keşiftir). Burada hata YERLEŞTİRME ve
   * ZAMANLAMA — yani yine bir karar, ama sonucu anında görünmüyor: kötü
   * yerleştirilmiş kule ancak düşman oradan geçerken belli oluyor.
   *
   * Bu yüzden sayaç kararı değil SONUCU ölçüyor: kaçan her düşman bir can.
   * Türün kendi dili de bu, oyuncu açıklama okumadan anlıyor.
   */
  lives: 3,

  /** Başlangıç parası tam iki kuleye yetiyor: ilk dokunuş beklemesiz. */
  startCash: 100,
  towerCost: 50,

  /** Kule menzili hücre cinsinden. */
  range: 1.75,
  fireEvery: 0.42,
  damage: 1,
  bulletSpeed: 11,

  idleHintAfter: 2.0,
  autoAdvanceAfter: 8,
  celebrateFor: 1.7,
};

/**
 * Yol: hücre koordinatlarında kırılma noktaları.
 * Düşman yukarıdan giriyor, aşağıdan çıkıyor. Zikzak kasıtlı — düz bir yol
 * tek kulenin her şeyi vurmasına izin verirdi ve yerleştirme kararı ölürdü.
 */
export const WAY: Array<[number, number]> = [
  [1, -1],
  [1, 2],
  [4, 2],
  [4, 5],
  [1, 5],
  [1, 8],
  [4, 8],
  [4, 10.6],
];

/** Kule yuvaları — yola komşu, tahtaya dağıtılmış. Sabit: reklamda rastgelelik yok. */
export const SLOTS: Array<[number, number]> = [
  [2, 1],
  [5, 3],
  [2, 4],
  [0, 6],
  [3, 7],
];

export interface FoeKind {
  sprite: string;
  hp: number;
  speed: number;
  reward: number;
  scale: number;
}

export const FOES: Record<string, FoeKind> = {
  // Ölçekler ekranda görüldükten sonra büyütüldü: 0.52'de piyadeler yolun
  // üstünde nokta gibi kalıyordu. Reklamda oyuncunun VURDUĞU şey görünmezse
  // geri bildirim de görünmüyor.
  a: { sprite: 'foe1', hp: 2, speed: 1.9, reward: 12, scale: 0.74 },
  b: { sprite: 'foe2', hp: 3, speed: 2.1, reward: 15, scale: 0.74 },
  c: { sprite: 'foe3', hp: 5, speed: 1.65, reward: 20, scale: 0.8 },
  tank: { sprite: 'tank', hp: 16, speed: 1.35, reward: 60, scale: 1.0 },
};

/**
 * Dalga tarifesi: [saniye, tür].
 *
 * İlk ayarda kazanma anı 37. saniyede geliyordu — playable için ÇOK GEÇ.
 * Reklamda ödül anına 30 saniyede varılmalı, yoksa izleyici o anı hiç
 * görmeden çıkıyor. Hızlar %25 artırıldı, tarife sıkıştırıldı, kule atış
 * aralığı da aynı oranda düşürüldü ki denge bozulmasın.
 */
export const WAVE: Array<[number, string]> = [
  [0.5, 'a'],
  [1.3, 'a'],
  [2.2, 'a'],
  [3.3, 'b'],
  [4.1, 'a'],
  [5.0, 'b'],
  [6.1, 'a'],
  [6.9, 'c'],
  [7.8, 'b'],
  [8.9, 'a'],
  [9.8, 'c'],
  [10.8, 'b'],
  [11.7, 'c'],
  [12.9, 'tank'],
];

export const COPY = {
  title: 'Tower Rush — Playable',
  goal: 'STOP THE WAVE',
  tutorial: 'TAP A PAD TO BUILD',
  tutorial2: 'BUILD ANOTHER ONE',
  cta: 'PLAY NOW',
  win: 'WAVE CLEARED!',
  winSub: 'not a single leak',
  winSubN: 'lives left',
  lose: 'BASE OVERRUN!',
  loseSub: 'They got through',
  brand: 'TOWER RUSH',
  tagline: 'Build. Aim. Hold the line.',
  again: 'TRY AGAIN',
  wave: 'WAVE',
};
