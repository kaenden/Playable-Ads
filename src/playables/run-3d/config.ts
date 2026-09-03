/**
 * Crowd Rush — koridorda büyüyen kalabalık.
 *
 * TÜR SEÇİMİ. Referans kreatiflerde en çok görülen 3D playable kalıbı bu:
 * karakter kendiliğinden koşuyor, oyuncunun tek işi sağa sola yön vermek.
 * Tek parmak, tek eksen, tek karar — öğrenme süresi sıfır.
 *
 * BAŞARISIZLIK KANCASI = KALABALIK SAYISI.
 *
 * Projedeki kural: sayaç, HATANIN YAŞADIĞI yeri ölçmeli. Merge'de hamle,
 * otoparkta süre, kule savunmasında can. Burada hata "yanlış kapıyı seçmek"
 * ve "engele girmek"; ikisinin de bedeli adam kaybetmek. O yüzden bu oyunda
 * ne süre var ne hamle: ekrandaki tek sayı kalabalık ve oyuncu kendi
 * hatasını doğrudan o sayının üstünde görüyor.
 *
 * TEMPO. Koşu hızı 6.6 birim/sn, bitiş 136. birimde -> ödül anı ~21 saniye.
 * Ağ önerisi 25-30 saniyeyi aşmamak; runner'da daha da erken bitmesi iyi,
 * çünkü tekrar oynanış (TRY AGAIN) ikinci bir izlenim şansı veriyor.
 */

/** Kapı işlemi. Ekranda operatörle birlikte gösteriliyor. */
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
 * Engel sırası: koridoru kapatan aralıklar. Çarpışma TÜM KALABALIK için
 * ayrı ayrı bakılıyor — kapalı aralıkta duran her adam eziliyor.
 *
 * Boşluk, BÜYÜMÜŞ kalabalığa göre ayarlandı: 20 kişilik bir kalabalık ~4.2
 * birim yer kaplıyor, boşluk 3.5. Yani tam ortadan geçmek bile birkaç kişiye
 * mal oluyor. Kasten böyle — kalabalık büyüdükçe engel de anlam kazanıyor.
 *
 * Bunu "lidere değdi mi" diye tek bir çarpışmaya indirmek daha kolaydı ama
 * ekranda okunmuyordu: kalabalık bir bulut, kenarından sıyırmakla ortadan
 * girmek aynı şey olmamalı.
 */
export interface Row {
  type: 'row';
  z: number;
  /** Kapalı x aralıkları. Aradaki boşluklar geçilebilir. */
  blocks: Array<[number, number]>;
  /** Görsel: her aralığa hangi model konacak. */
  prop: string;
}

export interface Finish {
  type: 'finish';
  z: number;
  /** Duvarı yıkmak için gereken kalabalık. */
  need: number;
}

export type Event = Gate | Row | Finish;

export const RUN = {
  /** Koridor yarı genişliği — kalabalığın merkezi bu sınırda tutuluyor. */
  halfW: 3.1,
  /** Kalabalığın merkezinin gidebileceği en uç nokta. */
  steerLimit: 2.5,
  speed: 6.6,
  /** Hız sıfırdan tam hıza bu sürede çıkıyor: ilk kare kamera hareketiyle açılmasın. */
  rampFor: 0.9,
  /** Yatay yumuşatma — parmak bırakınca kalabalık kaymaya devam etmesin. */
  steerLerp: 11,
  start: 5,
  /**
   * Ekranda aynı anda çizilen en fazla karakter.
   *
   * Kalabalık InstancedMesh ile çizildiği için bu sayının çizim çağrısına
   * etkisi YOK; sadece matris hesabı ve ekrandaki kalabalığın genişliği.
   * Kusursuz oynanış 29 kişi getiriyor, sınır onun üstünde duruyor.
   */
  renderCap: 32,
  /** Kalabalık dizilimi: i. adamın merkeze uzaklığı = spread * sqrt(i). */
  spread: 0.48,
  /** Kaç farklı koşu fazı var — animasyon bu kadar kez hesaplanıyor, kopyalanarak dağıtılıyor. */
  phases: 3,
  /** Kapının etkisi bu kadar sürede sayaca yansıyor (sayı akarken görünsün). */
  countFor: 0.45,
  idleHintAfter: 2.2,
  celebrateFor: 1.5,
  /** Bitişten sonra kapanış kartı bu kadar bekliyor. */
  endAfter: 1.4,
};

/**
 * PARKUR. z'ye göre sıralı; oyun sıradaki olayı geçtikçe ilerliyor.
 *
 * Denge (5 kişiyle başlayıp): kusursuz oynanış 5 -> 10 -> 20 -> 29,
 * baştan sona yanlış seçim 5 -> 3 -> 1 -> 1. Duvar 14 istiyor; yani
 * iki doğru seçim yetiyor, üç yanlış seçim kaybettiriyor. Ortadaki geniş
 * bant kasten böyle: playable'ın işi oyuncuyu elemek değil, kazandırmak.
 *
 * İYİ TARAF SIRAYLA DEĞİŞİYOR: sol, sağ, sol. İlk denemede iyi taraf iki kez
 * arka arkaya aynı yerdeydi ve oyuncunun parmağını bir daha oynatmasına
 * gerek kalmıyordu — "seçim yapılan oyun" hissi kayboluyordu.
 *
 * Ayrıca her kapının bir tarafı İYİ, diğeri KÖTÜ olmak zorunda. İlk kurulumda
 * ikinci kapının iki tarafı da kazandırıyordu; ekranda yan yana iki yeşil
 * panel vardı ve seçim diye bir şey yoktu.
 */
export const TRACK: Event[] = [
  { type: 'gate', z: 26, left: { kind: 'add', v: 5 }, right: { kind: 'sub', v: 2 } },
  {
    type: 'row',
    z: 48,
    blocks: [[-3.1, -1.9], [1.8, 3.1]],
    prop: 'rock_tallB',
  },
  { type: 'gate', z: 70, left: { kind: 'sub', v: 3 }, right: { kind: 'mul', v: 2 } },
  {
    type: 'row',
    z: 92,
    blocks: [[-3.1, -1.6], [1.7, 3.1]],
    // Kütük denendi ve olmadı: aralığa sığdırmak için enine sıkıştırılınca
    // yatan bir kütükten çok dikilmiş bir boruya benzedi. Ağaç kütüğü
    // (stump) sıkışınca da kütük gibi duruyor.
    prop: 'stump_round',
  },
  { type: 'gate', z: 112, left: { kind: 'add', v: 9 }, right: { kind: 'div', v: 2 } },
  { type: 'finish', z: 136, need: 14 },
];

export const TRACK_LEN = 152;

/** Kapının rengi doğrudan "iyi mi kötü mü" diyor; yazıyı okumaya gerek kalmıyor. */
export const GATE_COLOR = {
  good: '#2FBF71',
  bad: '#E5484D',
};

export function opLabel(o: Op): string {
  if (o.kind === 'add') return '+' + o.v;
  if (o.kind === 'sub') return '\u2212' + o.v;
  if (o.kind === 'mul') return '\u00D7' + o.v;
  return '\u00F7' + o.v;
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
  crowd: 'CROWD',
  win: 'WALL SMASHED!',
  winSub: 'runners made it',
  lose: 'NOT ENOUGH!',
  loseSub: 'you needed 14',
  again: 'TRY AGAIN',
  brand: 'CROWD RUSH',
  tagline: 'Grow your army. Break the wall.',
  need: 'NEED',
};
