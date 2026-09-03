/**
 * Blade Rush — koridorda silah fırlatan tek karakter.
 *
 * CROWD RUSH'IN KARDEŞİ. Koridor, karakter, asset paketi, kamera, ışık ve
 * derleme hattı birebir aynı; değişen tek şey MEKANİK. Vitrindeki ikinci
 * kontrollü karşılaştırma bu: ilki "aynı oyun, iki renderer", bu "aynı
 * renderer ve aynı asset, iki oyun". Tek bir yeni model üretilmedi —
 * düşmanlar oyuncunun kendi karakteri, silahlar kodda çiziliyor.
 *
 * SAYAÇ = SİLAH GÜCÜ.
 *
 * Projedeki kural yine geçerli: sayaç HATANIN YAŞADIĞI yeri ölçmeli.
 * Crowd Rush'ta hata adam kaybettiriyordu çünkü sayaç kalabalıktı. Burada
 * hata "yanlış kapı" ve bedeli "grubu temizleyememek"; temizlenemeyen her
 * düşman gücünden bir puan götürüyor. Yani tek sayı hem neyi yapabildiğini
 * hem neyi kaybettiğini aynı birimde söylüyor.
 *
 * NİŞAN ALMA YOK. Silahlar en yakın canlı düşmanı kendiliğinden buluyor.
 * Parmağın tek işi kapı seçmek — iki eksenli bir reklam öğrenilmiyor, ve
 * referans kreatiflerin hiçbirinde de nişan alma yok.
 */

export interface Op {
  kind: 'add' | 'sub' | 'mul' | 'div';
  v: number;
}

export interface Gate {
  type: 'gate';
  z: number;
  left: Op;
  right: Op;
}

/**
 * Düşman grubu. Konumları sabit: parkur her açılışta aynı, çünkü gösterim
 * başına değişen bir koşu hiçbir şey ölçmüyor (merge biriminden kalan ders).
 */
export interface Wave {
  type: 'wave';
  z: number;
  /** Kaç düşman. */
  count: number;
  /** Düşman başına can. */
  hp: number;
}

/** Kapanış: dev düşman. Canı bitmeden ona varırsan kaybediyorsun. */
export interface Boss {
  type: 'boss';
  z: number;
  hp: number;
}

export type Event = Gate | Wave | Boss;

export const STRIKE = {
  halfW: 3.1,
  steerLimit: 2.5,
  /**
   * Crowd Rush 9.0 koşuyor, bu 8.2.
   *
   * Sebep mekanik: orada bakılacak tek şey kapının rengi, burada bir de
   * silahların düşmana ulaşıp ulaşmadığı var. Aynı hızda ikisi birden
   * okunmuyordu.
   */
  speed: 8.2,
  rampFor: 0.9,
  steerLerp: 11,
  countIn: 1.2,

  /** Başlangıç silah gücü. Tek karakter, tek puan — büyüme buradan okunuyor. */
  start: 1,

  /** Silah fırlatma aralığı (saniye). */
  fireEvery: 0.13,
  /** Bu mesafeye giren gruba ateş açılıyor; boşluğa silah atılmıyor. */
  range: 24,
  /** Silahın ileri hızı (dünya birimi/sn) — koşu hızının üstüne biniyor. */
  shotSpeed: 34,
  /** Aynı anda havada olabilecek en fazla silah. */
  shotCap: 24,

  /** Saf başına en fazla düşman — fazlası arkaya yeni saf oluyor. */
  foeCols: 5,
  /** Saflar arası mesafe (z). */
  foeRowGap: 3.6,
  /** Ekranda aynı anda çizilen en fazla düşman (instancing: çizim çağrısına etkisi yok). */
  foeCap: 40,

  /** Kaç farklı animasyon fazı hesaplanıyor. */
  phases: 3,
  countFor: 0.4,
  idleHintAfter: 1.6,
  celebrateFor: 1.5,
  endAfter: 1.4,
};

/**
 * PARKUR. Crowd Rush ile aynı ritim: dört kapı, aralarında dört olay.
 *
 * DENGE — tarayıcıda ölçülerek ayarlandı, tahminle değil. Ölçerken çıkan
 * şey tasarımı da netleştirdi: grubun İKİ AYRI DÜĞMESİ var ve ikisi farklı
 * şeyi sınıyor.
 *
 *   hp    = tek atışta düşürmek için gereken GÜÇ EŞİĞİ. Gücün candan
 *           küçükse her düşman iki atış yiyor ve bütçen ikiye katlanıyor.
 *   count = pencerede yetiştirmen gereken ATIŞ SAYISI. Bir gruba ateş
 *           edilen süre sabit (menzil / hız), atış aralığı da sabit —
 *           yani kaç atış yapabileceğin baştan belli.
 *
 * İlk kurulumda ikisini birlikte oynatıyordum ve denge uçurumdan
 * düşüyordu: canı 20'den 22'ye çıkarmak kayıpsız geçilen bir grubu
 * 11 puan kaybettiren bir gruba çeviriyordu. Ayrıldıklarında ikisi de
 * ayarlanabilir hâle geldi.
 *
 * İyi taraf sırayla değişiyor (sol, sağ, sol, sağ) — arka arkaya aynı taraf
 * olduğunda oyuncunun parmağını bir daha oynatmasına gerek kalmıyor ve
 * "seçim yapılan oyun" hissi kayboluyor.
 */
export const TRACK: Event[] = [
  { type: 'gate', z: 20, left: { kind: 'add', v: 4 }, right: { kind: 'sub', v: 2 } },
  { type: 'wave', z: 40, count: 5, hp: 10 },
  { type: 'gate', z: 60, left: { kind: 'sub', v: 3 }, right: { kind: 'mul', v: 3 } },
  { type: 'wave', z: 80, count: 8, hp: 30 },
  { type: 'gate', z: 100, left: { kind: 'mul', v: 2 }, right: { kind: 'div', v: 2 } },
  { type: 'wave', z: 120, count: 10, hp: 90 },
  { type: 'gate', z: 140, left: { kind: 'div', v: 3 }, right: { kind: 'add', v: 14 } },
  { type: 'boss', z: 166, hp: 800 },
];

export const TRACK_LEN = 184;

/** Kapanış kartı ve HUD bunu dosyadan okuyor, elle yazılmıyor. */
export const BOSS_HP = (TRACK[TRACK.length - 1] as Boss).hp;

export const GATE_COLOR = {
  good: '#2FBF71',
  bad: '#E5484D',
};

export function opLabel(o: Op): string {
  if (o.kind === 'add') return '+' + o.v;
  if (o.kind === 'sub') return '−' + o.v;
  if (o.kind === 'mul') return '×' + o.v;
  return '÷' + o.v;
}

export function opGood(o: Op): boolean {
  return o.kind === 'add' || o.kind === 'mul';
}

export function applyOp(n: number, o: Op): number {
  if (o.kind === 'add') return n + o.v;
  if (o.kind === 'sub') return n - o.v;
  if (o.kind === 'mul') return n * o.v;
  return Math.floor(n / o.v);
}

export const COPY = {
  cta: 'PLAY NOW',
  tutorial: 'SWIPE TO STEER',
  pick: 'PICK THE GREEN GATE',
  crowd: 'POWER',
  win: 'BOSS DOWN!',
  winSub: 'power at the end',
  lose: 'TOO WEAK!',
  loseSub: 'the boss survived',
  again: 'TRY AGAIN',
  brand: 'BLADE RUSH',
  tagline: 'Upgrade your blade. Cut them down.',
  need: 'BOSS',
};
