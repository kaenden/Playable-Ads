/**
 * Gate Crashers — koridorda büyüyen kalabalık.
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
 * TEMPO. Koşu hızı 9.0 birim/sn, bitiş 176. birimde -> ödül anı ~20 saniye.
 * İlk sürüm 6.6 birim/sn idi ve olaylar arası 3.3 saniye sürüyordu: kapıyı
 * gördükten sonra beklemek kalıyordu, karar değil. Şimdi olay aralığı 2.2
 * saniye — parmak boşta kalmıyor.
 *
 * TEK KİŞİYLE BAŞLIYOR. Beş kişiyle başlamak türün vaadini ilk karede
 * harcıyordu: kalabalık zaten vardı, büyümesi fark edilmiyordu. Bir kişiden
 * otuza çıkmak bu formatın kancası; ilk kapı da bu yüzden 2.9. saniyede.
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
  /**
   * Engelin boyu. Tek bir sabit boy (1.95) her modele uymuyordu: kütük o
   * ölçekte kütüğe değil çuvala benziyordu, çünkü karakterin 1.7 katıydı.
   * Boy artık modelin kendi karakterine göre veriliyor — ve son sıra
   * bilerek alçak, arkasındaki NEED tabelası görünsün diye.
   */
  h?: number;
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
  speed: 9.0,
  /** Hız sıfırdan tam hıza bu sürede çıkıyor: ilk kare kamera hareketiyle açılmasın. */
  rampFor: 0.9,
  /** Yatay yumuşatma — parmak bırakınca kalabalık kaymaya devam etmesin. */
  steerLerp: 11,
  start: 1,
  /**
   * Ekranda aynı anda çizilen en fazla karakter.
   *
   * Kalabalık InstancedMesh ile çizildiği için bu sayının çizim çağrısına
   * etkisi YOK; sadece matris hesabı ve ekrandaki kalabalığın genişliği.
   * Kusursuz oynanış son kapıda 33 kişiye çıkıyor, sınır onun üstünde duruyor.
   */
  renderCap: 36,
  /** Kalabalık dizilimi: i. adamın merkeze uzaklığı = spread * sqrt(i). */
  spread: 0.48,
  /** Kaç farklı koşu fazı var — animasyon bu kadar kez hesaplanıyor, kopyalanarak dağıtılıyor. */
  phases: 3,
  /**
   * Açılış geri sayımı. Sayı başına 0.4 saniye, üçü 1.2 saniye.
   *
   * Kısa tutuldu: reklamın ilk saniyeleri en pahalı saniyeleri ve üç tam
   * saniyelik bir geri sayım kancanın yarısını yer. Amaç dramatik bir
   * başlangıç değil — izleyicinin parmağını yerleştirebileceği bir an, ve
   * "bu bir video değil, birazdan ben oynayacağım" bilgisi. Yön verme
   * geri sayım boyunca çalışıyor, ilerleme çalışmıyor.
   */
  countIn: 1.2,
  /** Kapının etkisi bu kadar sürede sayaca yansıyor (sayı akarken görünsün). */
  countFor: 0.45,
  idleHintAfter: 1.6,
  celebrateFor: 1.5,
  /** Bitişten sonra kapanış kartı bu kadar bekliyor. */
  endAfter: 1.4,
};

/**
 * PARKUR. z'ye göre sıralı; oyun sıradaki olayı geçtikçe ilerliyor.
 *
 * DÖRT KAPI, DÖRT ENGEL. İlk sürümde üç kapı iki engel vardı ve oyuncunun
 * eli 20 saniyenin çoğunda boştaydı.
 *
 * DENGE — simüle edilerek ayarlandı, tahminle değil. Ezilme sayısı
 * kalabalığın gerçek genişliğinden çıkıyor (phyllotaxis'te x = cos(i*GA) *
 * spread * sqrt(i)), o yüzden boşluklar kalabalık büyüdükçe genişliyor:
 * 0.95 -> 1.25 -> 1.75 -> 2.05.
 *
 *   kusursuz         1 -> 9 -> 8 -> 16 -> 12 -> 24 -> 21 -> 33 -> 28
 *   1. kapı kaçarsa  25    2. kapı kaçarsa  21
 *   3. kapı kaçarsa  18    4. kapı kaçarsa  13
 *
 * Duvar 24 istiyor. Yani ERKEN bir hata affediliyor, GEÇ bir hata
 * affedilmiyor — riziko parkur boyunca artıyor.
 *
 * VE SON ENGELDEN SONRAKİ AN KASTEN GERGİN: oyuncu üçüncü engeli 21 kişiyle
 * çıkıyor, duvarda "NEED 24" yazıyor, yani GERİDE. Son kapı kurtarıyor.
 * 2026 kreatif metası güç fantezisi değil, az kalsın kaybediyordun.
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
  { type: 'gate', z: 22, left: { kind: 'add', v: 8 }, right: { kind: 'sub', v: 2 } },
  { type: 'row', z: 42, blocks: [[-3.1, -0.95], [0.95, 3.1]], prop: 'rock_tallB', h: 1.9 },
  { type: 'gate', z: 62, left: { kind: 'sub', v: 3 }, right: { kind: 'add', v: 8 } },
  {
    type: 'row',
    z: 82,
    blocks: [[-3.1, -1.25], [1.25, 3.1]],
    // Kütük denendi ve olmadı: aralığa sığdırmak için enine sıkıştırılınca
    // yatan bir kütükten çok dikilmiş bir boruya benzedi. Ağaç kütüğü
    // (stump) sıkışınca da kütük gibi duruyor.
    prop: 'stump_round',
    h: 1.2,
  },
  { type: 'gate', z: 102, left: { kind: 'mul', v: 2 }, right: { kind: 'div', v: 2 } },
  { type: 'row', z: 122, blocks: [[-3.1, -1.75], [1.75, 3.1]], prop: 'rock_largeA', h: 1.55 },
  { type: 'gate', z: 142, left: { kind: 'sub', v: 8 }, right: { kind: 'add', v: 12 } },
  // Son engel alçak kalmalı: duvarın NEED tabelası bunun ardından görünüyor.
  { type: 'row', z: 160, blocks: [[-3.1, -2.05], [2.05, 3.1]], prop: 'rock_smallA', h: 1.1 },
  { type: 'finish', z: 176, need: 24 },
];

export const TRACK_LEN = 192;

/** Duvarın istediği sayı — HUD ve kapanış kartı buradan okuyor, elle yazılmıyor. */
export const NEED = (TRACK[TRACK.length - 1] as Finish).need;

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
  loseSub: 'you needed ' + NEED,
  again: 'TRY AGAIN',
  brand: 'GATE CRASHERS',
  tagline: 'Pick the gate. Break the wall.',
  need: 'NEED',
};
