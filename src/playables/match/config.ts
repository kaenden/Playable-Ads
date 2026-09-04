/**
 * Beşinci ve altıncı birim: AYNI match-3, iki renderer.
 *
 * Bu bir deney: sanat müşteriden geliyor ve İKİ SÜRÜMDE DE AYNI. 3D modeller
 * (Kenney Food Kit, CC0) hem sahnede model olarak kullanılıyor, hem de
 * offline render edilip 2D sürümün sprite'ı oluyor. Böylece "2D mi 3D mi"
 * sorusu sanattan arınıyor ve geriye sadece renderer'ın bedeli kalıyor.
 */
export const M = {
  cols: 6,
  rows: 7,
  kinds: 5,

  /**
   * Hedef: bu türden bu kadar topla.
   *
   * 10 ile başladım, ölçünce fazla çıktı: beş tür var, yani rastgele bir
   * eşleşmenin hedef türden olma olasılığı 1/5 ve hamle başına ortalama
   * ~0.6 hedef taşı geliyor. 12 hamlede beklenen ~7 — yani hedefe ancak
   * kusursuz oynayan varır ve reklam çoğu izleyicide kaybediliyor.
   * Reklam KAZANILABİLİR olmalı; 6, niyetli oynayanın rahat, rastgele
   * oynayanın kıl payı geçtiği yer.
   */
  target: 0,
  goal: 6,

  /**
   * FAIL-HOOK: HAMLE. Merge ile aynı, ve bu doğru — kural "sayaç hatanın
   * yaşadığı yeri ölçer". Match-3'te boşa giden takas bir KARAR: oyuncu
   * tahtaya bakıp seçiyor. Escape'teki tıkalı araca dokunmak gibi bilgi
   * toplama değil.
   *
   * Eşleşme üretmeyen takas hamle YAKMIYOR (taşlar geri dönüyor) — o bir
   * karar değil, el kayması ya da yanlış okuma.
   */
  moves: 12,

  /** Faz süreleri (saniye). Playable'da her şey kısa olmalı. */
  swapFor: 0.16,
  clearFor: 0.26,
  fallFor: 0.22,

  idleHintAfter: 2.2,
  autoAdvanceAfter: 9,
  celebrateFor: 1.7,
};

/** Tür adları — hem sprite hem model adı olarak kullanılıyor. */
export const KINDS = ['donut', 'cupcake', 'cherries', 'banana', 'burger'];

/**
 * Partikül ve HUD renkleri.
 *
 * Önceden sprite'ın baskın tonundan alınıyordu ve koyu tepside patlamalar
 * sönük kalıyordu: bej bir çöreğin patlaması da bej oluyor, erik zeminde
 * kaybediliyordu. Artık her tür KENDİ ailesinden ama doygunluğu tavana
 * çekilmiş bir renkle patlıyor — nesnenin rengi değil, PATLAMASININ rengi.
 * Modellere dokunulmadı; bunlar sadece partikül.
 */
export const TINT = ['#FFC271', '#FF74E2', '#FF4756', '#FFE23B', '#FF9E42'];

export const COPY = {
  title: 'Sweet Match — Playable',
  goal: 'COLLECT',
  tutorial: 'SWAP TO MATCH 3',
  cta: 'PLAY NOW',
  win: 'ORDER COMPLETE!',
  winSub: 'moves to spare',
  lose: 'OUT OF MOVES!',
  loseSub: 'So close to the order',
  brand: 'SWEET MATCH',
  tagline: 'Swap. Match. Serve.',
  again: 'TRY AGAIN',
  moves: 'MOVES',
};
