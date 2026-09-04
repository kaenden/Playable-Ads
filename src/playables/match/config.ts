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
   * FAIL-HOOK: HAMLE. Merge ile aynı, ve bu doğru — kural "sayaç hatanın
   * yaşadığı yeri ölçer". Match-3'te boşa giden takas bir KARAR: oyuncu
   * tahtaya bakıp seçiyor. Escape'teki tıkalı araca dokunmak gibi bilgi
   * toplama değil.
   *
   * Eşleşme üretmeyen takas hamle YAKMIYOR (taşlar geri dönüyor) — o bir
   * karar değil, el kayması ya da yanlış okuma.
   *
   * Sayı artık AŞAMADAN geliyor (bkz. STAGES); burada sadece başlangıç
   * değeri duruyor.
   */
  moves: 10,

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

/**
 * İKİ AŞAMA — sipariş bitince yenisi geliyor.
 *
 * Tek hedefli sürümde reklam ilk siparişte bitiyordu ve oyuncu tam ritmi
 * bulduğunda ekran kapanıyordu. İkinci sipariş, oynanışı uzatmadan
 * DEVAM hissi veriyor: "bitirdim" ile "kazandım" arasına bir eşik daha
 * koyuyor, ve mağazaya giden kişi oyunun devam ettiğini bilerek gidiyor.
 *
 * İkinci aşama başka bir türü istiyor ve daha yüksek: ilkinde öğrenilen
 * şey ikincisinde sınanıyor. Hamle bütçesi de sıfırlanıyor — kalan hamleyi
 * devretmek, ilk aşamayı iyi oynayanı ikinci aşamada cezalandırmıyor ama
 * kötü oynayanı da baştan bitirmiyor.
 */
export interface Stage {
  /** Toplanacak tür (KINDS indeksi). */
  target: number;
  goal: number;
  moves: number;
}

export const STAGES: Stage[] = [
  { target: 0, goal: 6, moves: 10 },
  // Ölçüldü: ipucunu takip eden kusursuz oyuncu 9 hedefi 12 hamlenin
  // 10'unda bitiriyordu, yani gerçek oyuncuya pay kalmıyordu. 8, aynı
  // oynayışta dört hamlelik boşluk bırakıyor — reklam KAZANILABİLİR
  // olmalı, zor değil.
  { target: 2, goal: 8, moves: 12 },
];

/**
 * ÖZEL FÜZYONLAR — üçten fazla taş birleşince.
 *
 * Match-3'ün bütün derinliği burada: üç taş sadece kayboluyor, dört taş
 * bir ROKET doğuruyor, beş taş ya da L/T kesişimi BOMBA. Bu birimde
 * roket anında patlıyor, tahtada beklemiyor — yirmi saniyelik bir reklamda
 * "özel taşı sakla, sonra kullan" katmanı öğrenilmiyor; gösterilmesi
 * gereken şey ödülün kendisi.
 */
export type BlastKind = 'row' | 'col' | 'area';
export interface Blast {
  kind: BlastKind;
  /** Patlamanın merkezi (hücre indeksi). */
  at: number;
}

export const COPY = {
  title: 'Sweet Match — Playable',
  goal: 'COLLECT',
  order: 'ORDER',
  nextOrder: 'NEW ORDER!',
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
