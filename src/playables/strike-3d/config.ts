/**
 * Blade Rush — koridorda silah fırlatan kalabalık.
 *
 * CROWD RUSH'IN KARDEŞİ. Koridor, karakter, asset paketi, kamera, ışık ve
 * derleme hattı birebir aynı; değişen tek şey MEKANİK. Tek bir yeni model
 * üretilmedi — düşmanlar oyuncunun kendi karakteri, silahlar kodda çiziliyor.
 *
 * İKİ SAYAÇ, İKİ AYRI KAYNAK.
 *
 * Referans kreatiften (Hell Escape) kare kare çıkarılan yapı bu. İlk
 * denememde ikisini tek sayıya indirmiştim ve yanlıştı: oyunun bütün
 * gerilimi ikisinin AYRI kazanılmasından geliyor.
 *
 *   ADAM SAYISI  kapılardan geliyor (×2, −8, +5, ÷2). Ne kadar HIZLI
 *                vurduğunu belirliyor: her adam ayrı silah fırlatıyor.
 *   SİLAH GÜCÜ   tuzaklardan geliyor. Tek vuruşun KAÇ hasar verdiğini
 *                belirliyor — ve hedefin canı tam olarak o kadar iniyor.
 *
 * Yani kapılar tempoyu, tuzaklar vuruşu büyütüyor. İkisi de olmadan son
 * patron kırılmıyor: kalabalık tek başına yeterince hızlı vuramıyor, güçlü
 * silah tek başına yeterince sık vuramıyor.
 *
 * TUZAK BİR FIRSAT, CEZA DEĞİL. Üstünde silah ikonu taşıyan hedefi
 * kırabilirsen silahın bir kademe yükseliyor; kıramazsan sadece yükselmiyor.
 * Ceza yalnızca yol kesen tuzaklarda: ayakta kalan her figür bir adam
 * götürüyor.
 *
 * NİŞAN ALMA YOK. Silahlar en yakın canlı hedefi kendiliğinden buluyor;
 * parmağın tek işi kapı seçmek. Referans kreatiflerin hiçbirinde de nişan
 * alma yok — iki eksenli bir reklam öğrenilmiyor.
 */

export interface Op {
  kind: 'add' | 'sub' | 'mul' | 'div';
  v: number;
}

/** Adam sayısını değiştiren kapı. */
export interface Gate {
  type: 'gate';
  z: number;
  left: Op;
  right: Op;
}

/**
 * Kırılacak hedef. Tuzak, silah yükseltmesi ve patron AYNI ŞEY — sadece
 * alanları farklı doluyor. Tek tip olması hem kodu hem parkuru sadeleştirdi:
 * üçünün de canı var, üçü de aynı şekilde eriyor, üçü de aynı sayıyı
 * gösteriyor.
 */
export interface Target {
  type: 'target';
  z: number;
  /** Kaç figür duruyor. Can düştükçe orantılı olarak azalıyorlar. */
  count: number;
  hp: number;
  /** Kırılınca silah bu değere çıkıyor. Yoksa hedef sadece yol kesiyor. */
  gives?: number;
  /** Son hedef: kırılamazsa oyun kaybediliyor. */
  boss?: boolean;
  /** Figür boyu çarpanı — patron dev. */
  scale?: number;
}

export type Event = Gate | Target;

export const STRIKE = {
  halfW: 3.1,
  steerLimit: 2.5,
  speed: 9.0,
  rampFor: 0.9,
  steerLerp: 11,
  countIn: 1.2,

  /** Başlangıç: tek adam, iki hasarlık silah. İkisi de en düşük değerinde. */
  startCrowd: 1,
  startWeapon: 2,

  /**
   * Atış aralığı = baseFire / atıcı sayısı.
   *
   * Kalabalık büyüdükçe akış SIKLAŞIYOR, vuruş büyümüyor. Hedefin canı her
   * vuruşta silah gücü kadar iniyor ve bu ekranda okunuyor; kalabalık bunu
   * ne kadar hızlı yaptığını belirliyor. İkisini karıştırmak — kalabalığı
   * da hasara çevirmek — ekrandaki sayıyı okunmaz yapardı.
   */
  baseFire: 0.5,
  /** Bundan fazlası akışı sıklaştırmıyor; ekranda okunmaz bir duvar olurdu. */
  throwCap: 14,
  minFire: 0.035,

  /** Bu mesafeye giren hedefe ateş açılıyor; boşluğa silah atılmıyor. */
  range: 19,
  shotSpeed: 40,
  shotCap: 26,

  /** Kalabalık dizilimi: i. adamın merkeze uzaklığı = spread * sqrt(i). */
  spread: 0.46,
  /** Ekranda çizilen en fazla adam (instancing: çizim çağrısına etkisi yok). */
  crowdCap: 30,

  /** Hedef safı: saf başına en fazla figür, ve saflar arası mesafe. */
  foeCols: 5,
  foeRowGap: 3.4,
  foeCap: 24,

  phases: 3,
  countFor: 0.4,
  idleHintAfter: 1.6,
  celebrateFor: 1.5,
  endAfter: 1.4,
};

/**
 * PARKUR — dört kapı, üç silah yükseltmesi, bir yol kesen tuzak, bir patron.
 *
 * DENGE. Bir hedefe menzil içindeyken atılabilen vuruş sayısı hesaplanabilir:
 * menzil / hız / (baseFire / atıcı). Yani "bu hedef kırılır mı" sorusunun
 * cevabı baştan belli, ve parkur ona göre kuruldu:
 *
 *   kapı 1  ×3 → 3 adam,  silah 2  →  22 canlık yükseltme → silah 3
 *   kapı 2  ×2 → 6 adam,  silah 3  →  70 canlık tuzak, sonra 72 canlık
 *                                     yükseltme          → silah 5
 *   kapı 3  ×2 → 12 adam, silah 5  → 240 canlık yükseltme → silah 9
 *   kapı 4  ×2 → 24 adam (14 ile sınırlı), silah 9 → 430 canlık patron
 *
 * Her adım BİLEREK dar: doğru kapıyı seçen oyuncu hedefi son saniyede
 * kırıyor. Bir kapıyı kaçırmak zinciri koparıyor, çünkü kırılamayan
 * yükseltme sonraki hedefi de erişilmez yapıyor — ceza tek seferlik değil,
 * birikimli. Referans kreatifin yaptığı da bu.
 *
 * İyi taraf sırayla değişiyor (sol, sağ, sol, sağ): arka arkaya aynı taraf
 * olduğunda oyuncunun parmağını bir daha oynatmasına gerek kalmıyor.
 */
export const TRACK: Event[] = [
  { type: 'gate', z: 19, left: { kind: 'mul', v: 3 }, right: { kind: 'sub', v: 1 } },
  { type: 'target', z: 38, count: 4, hp: 22, gives: 3 },
  { type: 'gate', z: 57, left: { kind: 'div', v: 2 }, right: { kind: 'mul', v: 2 } },
  { type: 'target', z: 76, count: 6, hp: 70 },
  { type: 'target', z: 95, count: 6, hp: 72, gives: 5 },
  { type: 'gate', z: 114, left: { kind: 'mul', v: 2 }, right: { kind: 'sub', v: 4 } },
  { type: 'target', z: 133, count: 8, hp: 240, gives: 9 },
  { type: 'gate', z: 152, left: { kind: 'div', v: 3 }, right: { kind: 'mul', v: 2 } },
  { type: 'target', z: 176, count: 1, hp: 430, boss: true, scale: 2.9 },
];

export const TRACK_LEN = 194;

export const BOSS_HP = (TRACK[TRACK.length - 1] as Target).hp;

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
  crowd: 'CREW',
  win: 'BOSS DOWN!',
  winSub: 'crew still standing',
  lose: 'TOO WEAK!',
  loseSub: 'the boss survived',
  again: 'TRY AGAIN',
  brand: 'BLADE RUSH',
  tagline: 'Grow the crew. Upgrade the blade.',
  need: 'BOSS',
};
