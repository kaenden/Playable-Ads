/**
 * 3D görünüm — koridor, kalabalık, kapılar, duvar.
 *
 * KARDEŞ BİRİMDEN AYRIŞMAK. Crowd Rush ile hat, koridor, kamera ve instancing
 * düzeni ortak; ilk sürümde ASSET SEÇİMİ ve RENK de ortaktı ve ikisi ekranda
 * aynı oyun gibi duruyordu. İzleyici bir oyunu mekaniğinden değil görüntüsünden
 * tanıyor.
 *
 * Bu birim bir KORSAN ADASINA taşındı ve ayrım iki katmanda kuruldu:
 *
 *   MODEL SEÇİMİ  Aynı Kenney kitlerinden başka parçalar: çam yerine palmiye,
 *                 çiçek ve mantar yerine küp, oberlisk, kano ve kütük;
 *                 karakterlerden de göz bantlı olanı. Paket ortak, seçim ayrı.
 *   RENK          Yeşil çayır yerine kumsal, ve koridorun iki yanında DENİZ —
 *                 tek ek düzlem, dokusu koddan.
 *
 * Deniz düzlemi bu sahnenin en ucuz kazancı: iki üçgen ve bir gradyan, ama
 * "ada" bilgisini tek başına o veriyor.
 *
 * SİS RENGİ = GÖKYÜZÜNÜN DİBİ. Arka plan CSS gradyanı, sahne şeffaf. Uzaktaki
 * nesneler sise karışıyor ve sis rengi gradyanın alt rengiyle AYNI; ufuk
 * çizgisinde dikiş görünmüyor. İkisi farklıyken uzakta düz bir bant çıkıyordu.
 *
 * KAMERA AÇISI HESAPLANIYOR, ELLE AYARLANMIYOR. Kalabalığın ekranın neresinde
 * duracağı `Layout.safeBottom`'dan geliyor: CTA butonunun üstünde kalmak
 * zorunda. Eğim, o hedefi tutturacak şekilde her yeniden boyutlandırmada
 * çözülüyor — 20:9 telefonda da tablette de kalabalık butonun arkasına
 * girmiyor.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  InstancedMesh,
  Group,
  HemisphereLight,
  Material,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  STRIKE, TRACK, TRACK_LEN, GATE_COLOR, RARITY, Gate, Target, opLabel, opGood, upgradeRank,
} from './config';
import { State, offsetX, offsetZ, targetSlot, standing } from './state';
import { Layout, UiState } from './layout';
import { Hud } from './hud';
import { weaponGeometry, weaponIcon, weaponName, weaponTier, WEAPONS } from './weapons';
import { Fx } from '../../core/fx';
import { outlinedText, roundRect } from '../../core/draw';

/** Arayüzle aynı yazı yığını — can sayıları HUD'un parçası gibi okunmalı. */
const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
import { Squad, blobTexture } from './squad';
import { propClone, propSize } from './models';
import { RunView } from './view';
import { Grade } from './grade';

const SKY = '#AEDCF2';
// KUMSAL, İZ VE DENİZ — üç ayrı değer, üçü de bilerek ayrık.
//
// Zeminin kendi rengi ışıktan SONRA istenen sonuca göre seçiliyor: zemin
// yatay, yani anahtar ışığın neredeyse tamamını alıyor ve açık seçilen her
// malzeme ekranda beyaza patlıyor.
//
// İZ KUMSALDAN AÇIK, tersi değil. Bir koşu oyununda okunması gereken ilk şey
// nerede koşulacağı; iki yüzey aynı değere düşerse koridorun kenarı kayboluyor.
const GROUND = '#E09A16';
const GRASS_DARK = '#A9741B';
/** İzin kenarındaki ıslak kum şeridi — koridorun sınırını çizen çizgi. */
const TRAIL_RIM = '#9A6B22';
const SAND = '#F0C13C';
/** Deniz: kıyıya yakın sığ turkuaz, açıkta koyu mavi. */
const SEA_SHALLOW = '#4FCBC6';
const SEA_DEEP = '#0E6389';
/** Kıyı çizgisindeki köpük — kumu denizden ayıran ince şerit. */
const FOAM = '#EAFBFA';
/**
 * Kumsalın yarı genişliği. Ötesi deniz.
 *
 * İlk denemede 13'tü ve deniz neredeyse görünmüyordu: 38 derecelik dikey
 * açıyla ve 0.6 en-boy oranıyla kamera 30 birim ileride sadece ±6 birim
 * yanı görüyor, yani su ancak ufukta beliriyordu. 8'e indirilince kıyı
 * koridorun hemen yanına geliyor ve sahne bir ADA gibi okunuyor.
 */
const BEACH_HALF = 8;
const CHAR_H = 1.15;

/**
 * ŞERİT KOORDİNATI -> DÜNYA X.
 *
 * Oyun mantığı x'i EKRAN gibi düşünüyor: artı yön sağ. three.js'te ise kamera
 * +Z'ye bakarken dünyanın +X ekseni ekranın SOLUNA düşüyor (kameranın kendi
 * sağı, ileri yönün ters vektörel çarpımı). İlk sürümde bu gözden kaçtı ve
 * parmağı sağa sürüklemek kalabalığı sola götürdü.
 *
 * Çeviri TEK YERDE, burada: durum ve 2D yedek görünüm ekran mantığında
 * kalıyor, sadece 3D sahne dünyaya geçerken işaret değiştiriyor.
 */
const LANE = -1;

/** Sahne her açılışta AYNI olsun: rastgelelik tohumlu. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Çim dokusu — yumuşak, alçak kontrastlı lekeler.
 *
 * Tek düz yeşil bir düzlem ekranda plastik gibi duruyordu: hiçbir yerinde
 * gözün tutunacağı bir şey yok. Lekeler o yüzeyi kırıyor. Kontrast kasten
 * düşük — desen fark edilmemeli, sadece "boş" hissi gitmeli. Karo 18 birimde
 * bir tekrar ediyor ve leke yumuşak olduğu için tekrar okunmuyor.
 */
function grassTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = GROUND;
  g.fillRect(0, 0, 256, 256);
  const rnd = lcg(4711);
  for (let i = 0; i < 110; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 14 + rnd() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    // SADECE KOYULTAN leke. Açık leke eklemek yeşili griye çekiyordu:
    // beyaza doğru her katkı doygunluğu düşürür, koyuya doğru katkı düşürmez.
    // Lekelerin yarısı SARI-YEŞİL ot, yarısı koyu kum. Tek renk bir zeminde
    // hiçbir yerde ton yoktu; iki farklı aile aynı düzlemde derinlik veriyor.
    grd.addColorStop(0, rnd() < 0.5 ? 'rgba(112,140,28,.24)' : 'rgba(140,86,14,.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(cv);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

/** İz dokusu: basıla basıla açılmış kum + ileri bakan şeritler (hız hissi). */
function pathTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = SAND;
  g.fillRect(0, 0, 128, 128);

  // ENİNE GÖLGELEME. Karo yalnızca z ekseninde tekrar ediyor, yani soldan
  // sağa olan her şey patikanın KESİTİ demek. Kenarları koyulaştırmak
  // patikayı zemine gömüyor; ortayı açmak da çiğnene çiğnene parlamış bir iz
  // izlenimi veriyor. Düz tek renk bir şeritte ikisi de yoktu.
  const cross = g.createLinearGradient(0, 0, 128, 0);
  cross.addColorStop(0, 'rgba(112,74,18,.44)');
  cross.addColorStop(0.08, 'rgba(176,132,44,.2)');
  // İzin ortasındaki açık şerit ALTIN, beyaz değil. Beyaza çalan bir vurgu
  // izi aydınlatıyor ama doygunluğunu düşürüyor: ölçtüm, %43'e iniyordu ve
  // kumsalın yanında hardal grisi kalıyordu.
  cross.addColorStop(0.36, 'rgba(255,206,96,.22)');
  cross.addColorStop(0.64, 'rgba(255,206,96,.22)');
  cross.addColorStop(0.92, 'rgba(168,132,66,.18)');
  cross.addColorStop(1, 'rgba(112,80,30,.4)');
  g.fillStyle = cross;
  g.fillRect(0, 0, 128, 128);

  // Çakıl taşı ve deniz kabuğu beneği.
  const rnd = lcg(1291);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 128;
    const y = rnd() * 128;
    const r = 1.2 + rnd() * 2.6;
    g.fillStyle = rnd() < 0.5 ? 'rgba(150,118,58,.3)' : 'rgba(255,252,238,.36)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(cv);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

/**
 * Deniz dokusu — enine derinlik gradyanı.
 *
 * Karo sadece Z'de tekrar ediyor, yani U ekseni suyun KESİTİ. Kıyıya yakın
 * (ortaya yakın) sığ turkuaz, kenarlara doğru koyu mavi. Simetrik, çünkü
 * kumsal ortada ve deniz iki yanda.
 *
 * Ayrıca ince açık şeritler: hareket etmeyen su ölü duruyordu, birkaç dalga
 * çizgisi yüzeye yön veriyor.
 */
function seaTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, SEA_DEEP);
  grd.addColorStop(0.34, SEA_SHALLOW);
  grd.addColorStop(0.5, SEA_SHALLOW);
  grd.addColorStop(0.66, SEA_SHALLOW);
  grd.addColorStop(1, SEA_DEEP);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 64);
  const rnd = lcg(90210);
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const y = rnd() * 64;
    const x = rnd() * 256;
    const w = 12 + rnd() * 40;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
  }
  const t = new CanvasTexture(cv);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

/** Kapı paneli: renk + kocaman operatör. Yazı okunmasa bile renk konuşuyor. */
function gateTexture(label: string, color: string): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = color;
  g.globalAlpha = 0.72;
  g.fillRect(6, 6, 244, 244);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,.95)';
  g.lineWidth = 12;
  g.strokeRect(12, 12, 232, 232);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 128px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(20,26,34,.85)';
  g.lineWidth = 16;
  g.strokeText(label, 128, 134);
  g.fillStyle = '#ffffff';
  g.fillText(label, 128, 134);
  return new CanvasTexture(cv);
}


interface Brick {
  mesh: Object3D;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

export class View3D implements RunView {
  L = new Layout();
  fx = new Fx();
  hud: Hud;
  cv: HTMLCanvasElement;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.5, 200);
  private hudCtx: CanvasRenderingContext2D;
  /** Oyuncu: tek figür, koşu klibi, toz kaldırıyor. */
  private player: Squad;
  /** Düşmanlar: aynı karakter, bekleme klibi, kırmızıya çalan, oyuncuya bakıyor. */
  private foeSquad: Squad;
  /** Patron: aynı karakterin devi. Yeni model üretilmedi, sadece ölçek. */
  private boss: Squad;
  /** Havadaki silahlar — kademe başına tek InstancedMesh. */
  private shotMeshes: InstancedMesh[] = [];
  private shotN: number[] = [];
  private weaponGeos: BufferGeometry[] = [];
  /** Elde duran silahın kademesi; değişince takıma yeni geometri veriliyor. */
  private heldTier = -1;
  private shotM = new Matrix4();
  private tumble = new Matrix4();
  private tilt = new Matrix4();
  /** Yerleşim dizileri: her karede yeniden ayrılmasın diye alanda duruyor. */
  private fx0 = new Float32Array(STRIKE.foeCap);
  private fz0 = new Float32Array(STRIKE.foeCap);
  private px0 = new Float32Array(STRIKE.crowdCap);
  private pz0 = new Float32Array(STRIKE.crowdCap);
  private bx0 = new Float32Array(1);
  private bz0 = new Float32Array(1);
  private bossDown = false;
  /** Hedef başına önceki karede ayakta kalan figür — ölüm efekti için. */
  private wasStanding: number[] = TRACK.map(() => -1);
  /** Hiç kımıldamayan her şey burada toplanıp tek seferde birleştiriliyor. */
  private statics = new Group();
  /** Süslerin ayak izleri — hepsi tek bir gölge yığınına dönüşecek. */
  private spots: Array<[number, number, number]> = [];
  private bricks: Brick[] = [];
  private wall = new Group();
  private smashT = -1;
  /** Kazanınca kalabalık duvarın ötesine koşmaya devam ediyor. */
  private after = 0;
  private wood = new MeshLambertMaterial({ color: new Color('#E28357') });
  /**
   * Engelin önündeki uyarı.
   *
   * İki tur denendi. Kırmızı yarı saydam bir zemin şeridi HALI gibi
   * duruyordu; koyu kahve yapınca da toprak lekesine dönüştü, uyarı olduğu
   * hiç anlaşılmıyordu. Doğru okuma bir ÇİZGİ: engelin tam önünde ince,
   * parlak, opak bir bant. Zeminde geniş bir alanı boyamak yerine bir sınır
   * çizmek, "buradan geçme"yi tek bakışta söylüyor.
   */
  private grade = new Grade();
  /** Koşarken kamera sallanıyor, dururken sallanmıyor. */
  private bobAmount = 0;
  private t = 0;
  private stepAcc = 0;
  /** Son karedeki kalabalık merkezi — HUD yazılarını oraya yansıtıyoruz. */
  private lastX = 0;
  private lastZ = 0;
  private onStep: (() => void) | null = null;

  constructor(gl: HTMLCanvasElement) {
    gl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    const hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none';
    document.body.appendChild(hud);
    this.cv = hud;
    this.hudCtx = hud.getContext('2d') as CanvasRenderingContext2D;
    document.body.style.background =
      // Gökyüzü ufuk çizgisine gelmeden sis rengine oturuyor. Kameranın
      // eğimi ekran oranına göre değiştiği için ufuk yukarı aşağı kayıyor;
      // gradyan geç bitseydi bazı telefonlarda ufukta bant görünürdü.
      'linear-gradient(180deg,#0E5CAE 0%,#2A83D2 8%,#68B2E6 14%,' + SKY + ' 19%,' + SKY + ' 100%)';

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    // Sis SADECE ufukta. Yakın başlayan sis orta planı da soldurüyordu.
    // Sis daha ERKEN başlıyor (76 -> 58). Ada paleti dört ayrı tona ayrılınca
    // uzak plan da yakın plan kadar canlı çıktı ve derinlik kayboldu; sisin
    // erken devreye girmesi uzağı gökyüzüne bağlıyor ve katmanları ayırıyor.
    this.scene.fog = new Fog(new Color(SKY).getHex(), 58, 146);

    // ÜÇ IŞIK, ÜÇ AYRI İŞ. İlk kurulumda tek yönlü ışık + ortam vardı ve
    // sahne öğle vakti gibi düz duruyordu: her yüzey aynı parlaklıkta,
    // hiçbir formun yönü okunmuyordu.
    //
    //  - anahtar: sıcak, soldan ve önden. Sahnenin saatini bu belirliyor.
    //  - dolgu  : soğuk, karşı taraftan ve zayıf. Gölgede kalan yüzler
    //             simsiyah değil, MAVİ olsun diye — sıcak/soğuk ayrımı
    //             görüntüyü tek renk bir yığın olmaktan çıkarıyor.
    //  - ortam  : gökten sıcak, yerden zeminin KENDİ rengi. Zeminden gelen
    //             yeşil, ağaçların altına doğal bir yansıma bırakıyor.
    // Anahtar ışık SOĞUK ve biraz daha zayıf: kar zaten çok geri veriyor,
    // sıcak bir anahtar burada eriyik gibi duruyordu.
    // Tropik öğle: anahtar sıcak ve yüksek.
    const key = new DirectionalLight(0xfff4d8, 1.28);
    key.position.set(-5, 7, -3);
    this.scene.add(key);
    // Dolgu KASTEN zayıf. Güçlü dolgu gölge tarafını da aydınlatıyor ve
    // formun yönü kayboluyor; sahne yine düz görünüyordu.
    // Dolgu DENİZDEN geliyor: turkuaz bir yansıma. Gölgede kalan yüzler
    // siyah değil deniz mavisi oluyor ve sahne tek bir kum yığını olmaktan
    // çıkıyor.
    const fill = new DirectionalLight(0x6FE0E8, 0.34);
    fill.position.set(5.5, 2.5, 4);
    this.scene.add(fill);
    // Yarım küre ışığı KISILDI (0.42 -> 0.26). Ölçtüm: zemin ekranda
    // %29 doygunlukta, yani hardal grisi çıkıyordu. Sebep gökten gelen soluk
    // mavi ortam ışığının yatay zemine tam çarpması — her yüzeye eklenen
    // beyaz doygunluğu düşürür. Kısılınca sıcak anahtar ışık baskın kalıyor
    // ve kum altın sarısına oturuyor.
    this.scene.add(new HemisphereLight(0xcdeeff, new Color(GROUND).getHex(), 0.26));

    this.buildGround();
    this.buildScenery();
    this.buildTrack();
    this.mergeStatic();
    this.buildSceneryShadows();

    this.player = new Squad({
      h: CHAR_H, clip: 'sprint', cap: STRIKE.crowdCap, dust: true, held: true,
    });
    this.scene.add(this.player.root);

    // DÜŞMANLAR ZOMBİ. Önce oyuncunun kendi karakteriydi, sadece kırmızıya
    // boyanıyordu; ekranda "aynı adam, başka renk" okunuyordu ve düşman
    // olduğu ancak yön farkından anlaşılıyordu. Paket 18 karakter taşıyor —
    // ikincisini almanın maliyeti tek bir doku (4.9 KB) ve o kadar.
    // Renk çarpanı yine var ama artık ince: yeşil teni bozmadan biraz
    // soğutuyor, kimliği modelin kendisi taşıyor.
    this.foeSquad = new Squad({
      h: CHAR_H, clip: 'idle', cap: STRIKE.foeCap, facing: Math.PI,
      model: 'character-l', tint: 0xd8ffd0, bob: 0.07,
    });
    this.scene.add(this.foeSquad.root);

    // Patron aynı karakterin 2.9 katı. Dev bir model üretmek yerine ölçek:
    // blok karakterde bu kayıpsız çalışıyor, silüet zaten kutulardan oluşuyor.
    // PATRON ÜÇÜNCÜ KARAKTER. Zombilerin devi olarak çizmek "aynı düşman ama
    // büyük" demekti; paketteki deniz yaratığı ise ayrı bir tür ve son
    // karşılaşmayı gerçekten SON karşılaşma yapıyor. Bedeli tek doku.
    this.boss = new Squad({
      h: CHAR_H * 2.9, clip: 'idle', cap: 1, facing: Math.PI,
      model: 'character-o', tint: 0xffe0d4, bob: 0.13,
    });
    this.scene.add(this.boss.root);
    this.buildShots();

    this.hud = new Hud(this.hudCtx, this.L);
    this.resize();
  }

  /** Ayak sesi geri çağrısı — ses bankasını görünüm tanımıyor. */
  setStepCallback(cb: () => void): void {
    this.onStep = cb;
  }

  // ------------------------------------------------------------------ sahne

  private buildGround(): void {
    const len = TRACK_LEN + 80;

    // DENİZ — bu sahneyi ada yapan tek şey, ve maliyeti iki üçgen.
    //
    // Dokusu enine bir gradyan: kıyıya yakın sığ turkuaz, açıkta koyu mavi.
    // Düz tek renk bir mavi düzlem "zemin başka renk" gibi duruyordu; derinlik
    // geçişi olmadan su okunmuyor. Kum düzleminin ALTINDA duruyor, aradaki
    // 22 santimlik fark da kıyı bankını veriyor.
    const st = seaTexture();
    st.repeat.set(1, len / 60);
    const sea = new Mesh(
      new PlaneGeometry(240, len),
      // Unlit: deniz ışıktan etkilenmiyor. Lambert'te anahtar ışık turkuazı
      // beyaza patlatıyordu ve ufukta gökyüzünden ayrılmıyordu.
      new MeshBasicMaterial({ map: st })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.22, len / 2 - 30);
    this.scene.add(sea);

    const gt = grassTexture();
    gt.repeat.set((BEACH_HALF * 2) / 18, len / 18);
    const ground = new Mesh(
      new PlaneGeometry(BEACH_HALF * 2, len),
      new MeshLambertMaterial({ map: gt })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, len / 2 - 30);
    this.scene.add(ground);

    // KORİDORUN KENARI. Kıyı bankı kumsalın sınırını çiziyor ama izin
    // sınırını çizmiyor; kum ile iz birbirine yakın değerde olduğu için
    // koşulacak şeridin nerede bittiği kayboluyordu. İnce koyu bir şerit
    // o sınırı geri getiriyor.
    for (const d of [-1, 1]) {
      const rim = new Mesh(
        new BoxGeometry(0.22, 0.12, len),
        new MeshLambertMaterial({ color: new Color(TRAIL_RIM) })
      );
      rim.position.set(d * (STRIKE.halfW + 0.35), 0.06, len / 2 - 30);
      this.scene.add(rim);
    }

    // Kıyı bankı ve köpük şeridi: kumun bittiği yeri çizen iki ince kutu.
    for (const d of [-1, 1]) {
      const bank = new Mesh(
        new BoxGeometry(0.5, 0.26, len),
        new MeshLambertMaterial({ color: new Color(GRASS_DARK) })
      );
      bank.position.set(d * BEACH_HALF, 0.0, len / 2 - 30);
      this.scene.add(bank);
      const foam = new Mesh(
        new BoxGeometry(1.1, 0.06, len),
        new MeshBasicMaterial({ color: new Color(FOAM) })
      );
      foam.position.set(d * (BEACH_HALF + 0.7), -0.14, len / 2 - 30);
      this.scene.add(foam);
    }

    const pt = pathTexture();
    pt.repeat.set(1, len / 7);
    const path = new Mesh(
      new PlaneGeometry(STRIKE.halfW * 2 + 0.5, len),
      new MeshLambertMaterial({ map: pt })
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.012, len / 2 - 30);
    this.scene.add(path);

    // Patika kenarındaki koyu şerit: koridorun sınırını gözle belli ediyor.
    for (const d of [-1, 1]) {
      const rim = new Mesh(
        new BoxGeometry(0.22, 0.12, len),
        new MeshLambertMaterial({ color: new Color(GRASS_DARK) })
      );
      rim.position.set(d * (STRIKE.halfW + 0.35), 0.06, len / 2 - 30);
      this.scene.add(rim);
    }
  }

  /**
   * Kenar süsü. Hepsi paketten geliyor; yerleşim tohumlu rastgele, yani her
   * açılışta aynı. Reklamda "her seferinde başka" bir şey yok: aynı kreatifin
   * iki farklı izlenimi aynı görünmeli.
   */
  private buildScenery(): void {
    const rnd = lcg(20260903);
    // Ağaç ve kaya AYNI ölçek aralığını paylaşamıyor: ilk denemede ikisi de
    // 2.6-5.0 birim yüksekliğe ölçeklendi ve kayalar koridoru kapatan devlere
    // dönüştü. Paketteki modelin kendi ölçüsü değil, sahnedeki ROLÜ belirliyor.
    const trees = ['tree_palmTall', 'tree_palmShort', 'tree_palmBend'];
    const rocks = ['rock_tallB', 'rock_largeA'];
    // Adada çam ve mantar olmaz: aynı paketten SEÇİM değişiyor. Kumsal otu,
    // tropik çalı, küçük kaya ve kıyıya bırakılmış küpler.
    const small = ['grass_leafs', 'plant_bushLarge', 'rock_smallA', 'pot_large'];
    // Seyrek "hikâye" parçaları: kıyıya çekilmiş kano, sönmüş ateş yeri,
    // harabeden kalan oberlisk ve sürüklenmiş kütük. Hepsi statik yığına
    // gittiği için çizim çağrısına hiçbir şey eklemiyorlar; işleri ADANIN
    // burada birinin yaşadığı bir yer olduğunu söylemek.
    const story = ['canoe', 'campfire_stones', 'statue_obelisk', 'log'];
    // Bitişin ÖTESİ de dolu olmalı: kazanınca kalabalık duvarın arkasına
    // koşuyor ve orada boş yeşillik görürse dünya bitmiş gibi duruyor.
    for (let z = -16; z < TRACK_LEN + 60; z += 5.4) {
      for (const d of [-1, 1]) {
        const roll = rnd();
        let name: string;
        let h: number;
        if (roll < 0.5) {
          name = trees[(rnd() * trees.length) | 0];
          h = 3.2 + rnd() * 2.1;
        } else if (roll < 0.72) {
          name = rocks[(rnd() * rocks.length) | 0];
          h = 1.1 + rnd() * 1.1;
        } else {
          name = small[(rnd() * small.length) | 0];
          h = 0.35 + rnd() * 0.3;
        }
        const g = propClone(name, h);
        if (!g) continue;
        const px = d * (STRIKE.halfW + 1.0 + rnd() * 3.2);
        const pz = z + rnd() * 3;
        g.position.set(px, 0, pz);
        g.rotation.y = rnd() * Math.PI * 2;
        this.statics.add(g);
        // Gölgenin genişliği modelin kendi eninden geliyor: ince bir çam ile
        // yayvan bir kaya aynı lekeyi bırakmamalı.
        const sz = propSize(name);
        this.spots.push([px, pz, sz ? (sz.x / (sz.y || 1)) * h * 1.5 : h]);
      }
      // RESİF TAŞLARI. Crowd Rush'ta bu döngü uzağa iri ağaçlar koyuyordu;
      // burada kumsal bitiyor, o yüzden aynı bütçe SUYUN İÇİNE gidiyor.
      // Sudan çıkan birkaç taş, düz turkuaz bir düzlemi denize çeviriyor —
      // ve gölge lekesi almadıkları için yüzüyormuş gibi de durmuyorlar.
      for (const d of [-1, 1]) {
        if (rnd() > 0.62) continue;
        const reef = propClone('rock_smallA', 0.4 + rnd() * 0.7);
        if (!reef) continue;
        reef.position.set(d * (BEACH_HALF + 1.2 + rnd() * 7), -0.24, z + rnd() * 5);
        reef.rotation.y = rnd() * Math.PI * 2;
        this.statics.add(reef);
      }

      // KENAR DETAYI. Uzun ve boş bir patika kenarı ekranda "yapılmamış"
      // duruyordu. Patikanın hemen dibine çim tutamı, çiçek ve küçük taş
      // serpmek doluluk hissini tek başına veriyor — hepsi statik yığına
      // gittiği için çizim çağrısına da bir şey eklemiyor.
      for (const d of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          if (rnd() > 0.62) continue;
          const tiny = propClone(small[(rnd() * small.length) | 0], 0.22 + rnd() * 0.22);
          if (!tiny) continue;
          tiny.position.set(d * (STRIKE.halfW + 0.5 + rnd() * 0.9), 0, z + rnd() * 5.2);
          tiny.rotation.y = rnd() * Math.PI * 2;
          this.statics.add(tiny);
        }
      }

      // Ara sıra hikâye parçası: kıyıya çekilmiş kano, ateş yeri, oberlisk.
      if (rnd() < 0.3) {
        const d = rnd() < 0.5 ? -1 : 1;
        const name = story[(rnd() * story.length) | 0];
        const h = name === 'statue_obelisk' ? 2.6 : name === 'canoe' ? 0.62 : 0.5;
        const g = propClone(name, h);
        if (g) {
          const px = d * (STRIKE.halfW + 2.2 + rnd() * 3.4);
          const pz = z + rnd() * 4;
          g.position.set(px, 0, pz);
          g.rotation.y = rnd() * Math.PI * 2;
          this.statics.add(g);
          this.spots.push([px, pz, h * (name === 'canoe' ? 4.2 : 1.4)]);
        }
      }

      // Ara sıra çit kümesi: koridorun kenarını vurguluyor.
      if (rnd() < 0.24) {
        for (const d of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const f = propClone('fence_planks', 0.85);
            if (!f) continue;
            f.position.set(d * (STRIKE.halfW + 0.75), 0, z + k * 1.0);
            f.rotation.y = Math.PI / 2;
            this.statics.add(f);
          }
        }
      }
    }
  }

  /**
   * SÜS GÖLGELERİ — hepsi tek çizim çağrısı.
   *
   * Gölgesiz ağaç zeminin üstünde DURMUYOR, havada duruyor gibi görünüyor;
   * bunu kimse tarif edemez ama herkes fark eder. Gerçek gölge haritası bu
   * ölçekte lüks (mobilde tek başına kare süresinin yarısını yiyor), o yüzden
   * kalabalıkta kullandığımız yumuşak lekenin aynısı, sabit matrislerle.
   */
  private buildSceneryShadows(): void {
    if (!this.spots.length) return;
    const geo = new PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const im = new InstancedMesh(
      geo,
      new MeshBasicMaterial({
        map: blobTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
      this.spots.length
    );
    const m = new Matrix4();
    for (let i = 0; i < this.spots.length; i++) {
      const [x, z, r] = this.spots[i];
      // Işık soldan geldiği için leke hafif sağa kaçıyor.
      m.makeScale(r, 1, r * 0.8);
      m.setPosition(x + r * 0.12, 0.025, z + r * 0.06);
      im.setMatrixAt(i, m);
    }
    im.renderOrder = -2;
    this.scene.add(im);
    this.spots.length = 0;
  }

  private buildTrack(): void {
    for (const ev of TRACK) {
      // Düşman grupları STATİK DEĞİL: konumları durumda, çizimleri instanced
      // takımda. Burada sadece kapılar ve patronun arkasındaki barikat var.
      if (ev.type === 'gate') this.buildGate(ev);
      else if (ev.boss) this.buildFinish(ev);
    }
  }

  private buildGate(ev: Gate): void {
    const g = new Group();
    const w = STRIKE.halfW;
    const h = 2.5;
    for (const side of [-1, 1]) {
      const op = side < 0 ? ev.left : ev.right;
      const color = opGood(op) ? GATE_COLOR.good : GATE_COLOR.bad;
      const panel = new Mesh(
        new PlaneGeometry(w, h),
        new MeshBasicMaterial({
          map: gateTexture(opLabel(op), color),
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
        })
      );
      panel.position.set((LANE * side * w) / 2, h / 2 + 0.05, 0);
      // Panelin ÖN yüzü kameraya baksın. Çevrilmeden bırakıldığında yazı
      // arkadan görülüyor ve ayna görüntüsü çıkıyor ("2x" -> "x2").
      panel.rotation.y = Math.PI;
      g.add(panel);
    }
    g.position.z = ev.z;
    this.scene.add(g);

    // Direkler ve üst kiriş — paketin ahşap rengiyle. Bunlar kımıldamıyor,
    // o yüzden birleştirilecek yığına gidiyorlar; panellerin kendisi ayrı
    // kalıyor çünkü her birinin dokusu farklı.
    const frame = new Group();
    for (const x of [-w, 0, w]) {
      const post = new Mesh(new BoxGeometry(0.16, h + 0.35, 0.16), this.wood);
      post.position.set(x, (h + 0.35) / 2, 0);
      frame.add(post);
    }
    const beam = new Mesh(new BoxGeometry(w * 2 + 0.16, 0.2, 0.2), this.wood);
    beam.position.set(0, h + 0.35, 0);
    frame.add(beam);
    frame.position.z = ev.z;
    this.statics.add(frame);
  }

  /**
   * Silahlar — kademe başına tek InstancedMesh.
   *
   * İlk sürümde fırlatılan şey tek bir sarı kutuydu ve silah olarak
   * okunmuyordu: ekranda uçan bir çizgi vardı, o kadar. Oysa bu oyunun iki
   * sayacından biri SİLAH GÜCÜ — silahın kendisi görünmüyorsa yükseltme de
   * sadece bir sayının değişmesi oluyor.
   *
   * Şimdi dört kademe var (bıçak, balta, kılıç, çift ağızlı balta) ve her
   * biri `weapons.ts`'teki tarifden üretiliyor. Kademe başına tek mesh, tek
   * malzeme: köşe rengi sayesinde çelik, ahşap ve altın aynı çizim çağrısında.
   * Aynı anda havada sadece bir ya da iki kademe olabildiği için (yükseltme
   * anında eski silahlar hâlâ uçuyor) pratikte bu bir-iki çizim çağrısı.
   */
  private buildShots(): void {
    // Kendi rengini taşıyan malzeme: `vertexColors` olmadan tek renkli olurdu.
    // Hafif ışıma, silahların koyu zeminde ve uzakta sisin içinde de
    // okunmasını sağlıyor.
    const mat = new MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2a30 });
    for (let t = 0; t < WEAPONS.length; t++) {
      // Aynı geometri hem havadaki silahta hem ELDEKİ silahta kullanılıyor.
      this.weaponGeos.push(weaponGeometry(t));
      const im = new InstancedMesh(this.weaponGeos[t], mat, STRIKE.shotCap);
      im.frustumCulled = false;
      im.count = 0;
      im.visible = false;
      this.shotMeshes.push(im);
      this.shotN.push(0);
      this.scene.add(im);
    }
  }

  private mergeStatic(): void {
    this.statics.updateMatrixWorld(true);
    const buckets = new Map<Material, { pos: number[]; nor: number[]; idx: number[] }>();
    const v = new Vector3();
    const nm = new Matrix3();
    this.statics.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const geo = m.geometry as BufferGeometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      const nor = geo.getAttribute('normal');
      const mat = m.material as Material;
      let b = buckets.get(mat);
      if (!b) {
        b = { pos: [], nor: [], idx: [] };
        buckets.set(mat, b);
      }
      const base = b.pos.length / 3;
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld);
        b.pos.push(v.x, v.y, v.z);
        if (nor) {
          v.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nm).normalize();
          b.nor.push(v.x, v.y, v.z);
        } else {
          b.nor.push(0, 1, 0);
        }
      }
      const idx = geo.getIndex();
      if (idx) for (let i = 0; i < idx.count; i++) b.idx.push(base + idx.getX(i));
      else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
    });
    buckets.forEach((b, mat) => {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new Float32BufferAttribute(b.nor, 3));
      geo.setIndex(b.idx);
      this.scene.add(new Mesh(geo, mat));
    });
    this.statics.clear();
  }

  private buildFinish(ev: Target): void {
    const cols = 7;
    const rows = 3;
    const bw = (STRIKE.halfW * 2) / cols;
    const bh = 0.92;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const b = propClone('statue_block', bh);
        if (!b) continue;
        const sz = propSize('statue_block');
        if (sz) b.scale.x = (bw * 0.98) / sz.x;
        b.position.set(-STRIKE.halfW + bw * (c + 0.5), r * bh, 0);
        b.userData.x0 = b.position.x;
        b.userData.y0 = b.position.y;
        this.wall.add(b);
        this.bricks.push({
          mesh: b,
          vx: (c - (cols - 1) / 2) * 1.5 + (r - 1) * 0.4,
          vy: 3.2 + r * 1.2,
          vz: 3.4 + Math.abs(c - (cols - 1) / 2) * 0.4,
          spin: (c % 2 ? 1 : -1) * (2 + r),
        });
      }
    }
    // Tabela yok: burada okunması gereken sayı patronun canı ve o HUD'da,
    // dev figürün başının üstünde duruyor. Duvarın işi barikat olmak.
    this.wall.position.z = ev.z + 3.4;
    this.scene.add(this.wall);
  }

  // ------------------------------------------------------------------ kamera

  resize(): void {
    this.L.update();
    const { w, h, dpr } = this.L;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.grade.resize(w, h, Math.min(dpr, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Kamerayı kalabalığın arkasına koy ve eğimi HESAPLA.
   *
   * Hedef: kalabalık ekranda `safeBottom`'ın biraz üstünde dursun. Bir noktanın
   * ekrandaki dikey yeri, kameranın yatayla yaptığı açı ile o noktaya bakış
   * açısının farkından çıkıyor; eğim o farkı istediğimiz değere oturtacak
   * şekilde çözülüyor. Sabit bir eğim, uzun telefonlarda kalabalığı CTA'nın
   * arkasına sokuyordu.
   */
  private placeCamera(cx: number, cz: number): void {
    const L = this.L;
    const cam = this.camera;
    // UZUN LENS. 45 dereceyle sahne geniş açı gibi duruyordu: yakındaki
    // koşucular şişiyor, uzak plan çöküyordu. 38 derece + geriden bakış
    // perspektifi yatıştırıyor ve görüntü "afiş" gibi oturuyor.
    const back = 12.6;
    const high = 6.0;
    const focusY = 0.7;

    const yPix = L.safeBottom - L.h * 0.2;
    const ndc = 1 - (2 * yPix) / L.h;
    const fovY = (cam.fov * Math.PI) / 180;
    const theta = Math.atan2(high - focusY, back);
    let pitch = theta - Math.atan(-ndc * Math.tan(fovY / 2));
    pitch = Math.max(0.1, Math.min(0.52, pitch));

    // Koşu sallanması: adım temposuna kilitli çok küçük bir dikey salınım
    // ve bir derecelik yatma. Kamerayı tamamen sabit tutmak sahneyi kaydırılan
    // bir fotoğraf gibi gösteriyordu; hareket hissi kameradan da gelmeli.
    const bob = this.bobAmount * Math.sin(this.t * 11.6);
    const sway = this.bobAmount * Math.sin(this.t * 5.8) * 0.6;

    const camX = LANE * cx * 0.55 + sway;
    cam.position.set(camX, high + bob * 0.5, cz - back);
    cam.up.set(0, 1, 0);
    cam.lookAt(camX, high - Math.tan(pitch) * 20, cz - back + 20);
    cam.rotation.z += sway * 0.05;
  }

  // ------------------------------------------------------------------ olaylar

  /** Kalabalığın ekrandaki yeri — HUD'un "+5" yazısını oraya koyuyoruz. */
  private playerScreen(cx: number, cz: number): [number, number] {
    const v = new Vector3(LANE * cx, CHAR_H * 1.4, cz);
    v.project(this.camera);
    return [((v.x + 1) / 2) * this.L.w, ((1 - v.y) / 2) * this.L.h];
  }

  /** Dünya noktasını ekrana çevir — düşman ölüm efektleri bunu kullanıyor. */
  private worldScreen(wx: number, wz: number, wy: number): [number, number] {
    const v = new Vector3(wx, wy, wz);
    v.project(this.camera);
    return [((v.x + 1) / 2) * this.L.w, ((1 - v.y) / 2) * this.L.h];
  }

  gate(good: boolean, label: string): void {
    const [x, y] = this.playerScreen(this.lastX, this.lastZ);
    this.hud.pop(x, y, label, good ? GATE_COLOR.good : GATE_COLOR.bad);
    this.fx.burst(x, y, this.L.w * 0.06, good ? 3 : 1, good ? '#8ED0FF' : '#FFB4B4');
    this.grade.pulse(good ? '#BFE0FF' : '#FF9A9A');
  }

  /** Temizlenemeyen düşmanların bedeli — güçten düşen puan. */
  hurt(n: number): void {
    const [x, y] = this.playerScreen(this.lastX, this.lastZ);
    this.hud.pop(x, y, '−' + n, GATE_COLOR.bad);
    this.fx.burst(x, y, this.L.w * 0.07, 4, '#FF9A9A');
    this.fx.shake = this.L.w * 0.05;
    this.grade.pulse('#FF7A7A');
  }

  /**
   * Hedef kırıldı. Efekt KIRILANIN yerinde patlıyor, oyuncunun değil — ve
   * yükseltme veren hedef daha büyük patlıyor, çünkü kazanılan şey farklı.
   */
  broke(wz: number, upgraded: number): void {
    const [x, y] = this.worldScreen(0, wz, CHAR_H * 1.1);
    if (upgraded) {
      // Sayı değil İSİM: yeni sayıyı zaten kart gösteriyor, burada okunması
      // gereken şey elindekinin değiştiği.
      this.hud.pop(x, y, weaponName(upgraded), '#FFD45F');
      this.fx.burst(x, y, this.L.w * 0.1, 7, '#FFD45F');
      this.grade.pulse('#FFE6A8');
    } else {
      this.fx.burst(x, y, this.L.w * 0.07, 4, '#FFD07A');
    }
  }

  /**
   * Bir vuruş değdi.
   *
   * NORMAL VURUŞ SESSİZ VE KÜÇÜK. Saniyede on dört vuruş var; her birine
   * tam bir patlama vermek ekranı sise çeviriyordu. Dört kıvılcım yetiyor:
   * "değdi" bilgisi geliyor, dikkat çalınmıyor.
   *
   * KRİTİK İSE OLAY. Kırmızı ve büyük bir sayı, gerçek bir patlama ve kısa
   * bir sarsıntı — çünkü kritiğin işi zaten fark edilmek.
   */
  hit(wx: number, wz: number, dmg: number, crit: boolean): void {
    const [x, y] = this.worldScreen(LANE * wx, wz, CHAR_H * 0.9);
    if (!crit) {
      this.fx.spark(x, y, this.L.w * 0.05, '#FFE9A8');
      return;
    }
    this.hud.pop(x, y, String(dmg), '#FF4A3D', 1.2, 0.6);
    this.fx.burst(x, y, this.L.w * 0.075, 3, '#FF9A6A');
    this.fx.shake = this.L.w * 0.028;
    this.grade.pulse('#FFC0A0');
  }

  finish(won: boolean): void {
    // Kazanınca klip DEĞİŞMİYOR: oyuncu koşarak barikatın içinden geçiyor.
    // Sevinme animasyonu koşuyla çelişiyordu — aynı anda hem koş hem zıpla.
    if (won) this.smashT = 0;
    else this.player.setClip('idle');
  }

  reset(): void {
    this.smashT = -1;
    for (let i = 0; i < this.wasStanding.length; i++) this.wasStanding[i] = -1;
    this.after = 0;
    this.stepAcc = 0;
    this.hud.reset();
    for (const b of this.bricks) {
      b.mesh.position.set(b.mesh.userData.x0 as number, b.mesh.userData.y0 as number, 0);
      b.mesh.rotation.set(0, 0, 0);
      b.mesh.visible = true;
    }
    this.wall.visible = true;
    this.bossDown = false;
    this.player.setClip('sprint');
  }

  /**
   * DÜŞMANIN CANI, ÜSTÜNDE YAZIYOR.
   *
   * Referans kreatifin (Hell Escape) bütün okunabilirliği buradan geliyor.
   * Kareleri tek tek çıkarıp sayıları okuduğumda dizi şu çıktı:
   * 100, 88, 76, 64, 52, 40, 28, 16, 4 — hepsi ON İKİŞER, ve sağdaki
   * "EQUIPPED" kartında yazan sayı tam olarak 12.
   *
   * Yani reklam oyuncuya hiçbir şey anlatmıyor; oyuncu ARİTMETİĞİ KENDİ
   * yapıyor ve mekaniği üç saniyede kavrıyor. Silah gücü ile hedefin canı
   * aynı ekranda, aynı birimde. Bende bu yoktu: düşmanlar sessizce
   * kayboluyordu, güç sayısının ne işe yaradığı hiçbir yerde görünmüyordu.
   *
   * Yakındaki sayı büyük, uzaktaki küçük — mesafe bilgisi yazının kendi
   * boyutundan geliyor, ayrıca perspektif hesabı gerekmiyor.
   */
  private drawTargetHp(g: CanvasRenderingContext2D, s: State, cz: number): void {
    for (let e = 0; e < TRACK.length; e++) {
      const ev = TRACK[e];
      if (ev.type !== 'target') continue;
      const ts = s.targets[e];
      if (ts.broken) continue;
      const d = ev.z - cz;
      if (d < -1 || d > STRIKE.range + 12) continue;
      const top = CHAR_H * (ev.scale ? ev.scale * 1.18 : 1.72);
      const [x, y] = this.worldScreen(0, ev.z, top);
      const k = 1 - Math.max(0, d) / (STRIKE.range + 12);
      const size = Math.round(Math.min(this.L.w * 0.115, 56) * (0.5 + k * 0.85));
      g.save();
      g.globalAlpha = 0.4 + k * 0.6;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 ' + size + 'px ' + FONT;
      outlinedText(g, String(Math.ceil(ts.hp)), x, y, size, '#ffffff', '#ffffff', 'rgba(18,24,30,.9)');
      // YÜKSELTME VEREN HEDEF İKONUNU TAŞIYOR. Referansta da böyle: kırınca
      // ne kazanacağını hedefin üstünde görüyorsun, kırdıktan sonra değil.
      if (ev.gives) {
        // İkon KAZANILACAK SİLAHIN kendisi: hedefin üstünde duran şekil ile
        // kırdıktan sonra havada uçan şekil aynı. Genel bir "yükseltme"
        // rozeti bunu söyleyemezdi.
        //
        // YERİ SAYININ ALTI, ÜSTÜ DEĞİL. Üstte denendi ve çalışmadı: hedefler
        // ile kapılar 19 birim arayla dizili, yani ekranda hedefin üstü çoğu
        // zaman bir sonraki kapının paneline denk geliyor ve ikon panelin
        // içinde kayboluyordu. Altında ise düşman figürlerinin üstünde
        // duruyor — hem koyu bir zemin buluyor hem de referanstaki gibi
        // "silah düşmanın üzerinde" okunuyor.
        //
        // NADİRLİK ÇERÇEVESİ. Oyuncunun zaten bildiği dil: yeşil sıradan,
        // mavi nadir, mor epik. Parkurun üç yükseltmesi sırayla bu üçünü
        // taşıyor, yani "sonuncusu en iyisi" bilgisi yazı olmadan geliyor.
        // Çerçeve hafifçe süzülüyor ve nefes alan bir parıltısı var: duran
        // bir rozet dekor, kıpırdayan bir rozet ÖDÜL gibi okunuyor.
        const rank = upgradeRank(e);
        const col = RARITY[Math.max(0, Math.min(RARITY.length - 1, rank))];
        const float = Math.sin(this.t * 2.4 + rank * 1.3) * size * 0.09;
        const glow = 0.55 + 0.45 * Math.sin(this.t * 3.1 + rank);
        const iy = y + size * 0.94 + float;
        const box = size * 0.86;
        g.save();
        g.shadowColor = col;
        g.shadowBlur = box * (0.24 + glow * 0.34);
        g.fillStyle = 'rgba(14,20,30,.72)';
        roundRect(g, x - box / 2, iy - box / 2, box, box, box * 0.22);
        g.fill();
        g.strokeStyle = col;
        g.lineWidth = Math.max(2, box * 0.07);
        roundRect(g, x - box / 2, iy - box / 2, box, box, box * 0.22);
        g.stroke();
        g.restore();
        weaponIcon(g, x, iy, box * 0.34, weaponTier(ev.gives));
        const fs = Math.round(size * 0.4);
        g.font = '900 ' + fs + 'px ' + FONT;
        outlinedText(g, '+' + ev.gives, x + box * 0.62, iy + box * 0.34, fs,
          '#FFD45F', '#FF9F45', 'rgba(16,12,20,.9)');
      }
      g.restore();
    }
  }

  /**
   * Havadaki silahlar.
   *
   * Her atış FIRLATILDIĞI ANDAKİ gücü taşıyor, o yüzden kademesi de ondan
   * çıkıyor: yükseltme anında havadaki eski silahlar eski hâlleriyle uçmaya
   * devam ediyor, sonradan kılıca dönüşmüyorlar.
   *
   * DÖNÜŞ EKSENİ Z. İlk sürüm Y ekseninde döndürüyordu — pervane gibi, ve
   * kamera arkadan baktığı için silah yarı zaman kenardan görünüp
   * kayboluyordu. Z ekseni ekrana dik: silah saat yelkovanı gibi dönüyor ve
   * silüeti her karede tam okunuyor. Küçük bir X yatması, tamamen düz bir
   * kâğıt gibi durmasını engelliyor.
   */
  private updateShots(s: State): void {
    for (let t = 0; t < this.shotN.length; t++) this.shotN[t] = 0;
    for (const sh of s.shots) {
      const t = weaponTier(sh.dmg);
      const im = this.shotMeshes[t];
      if (!im) continue;
      const i = this.shotN[t];
      if (i >= STRIKE.shotCap) continue;
      this.tumble.makeRotationZ(sh.spin);
      this.tilt.makeRotationX(0.34);
      this.shotM.multiplyMatrices(this.tilt, this.tumble);
      this.shotM.setPosition(LANE * sh.x, CHAR_H * 0.78, sh.z);
      im.setMatrixAt(i, this.shotM);
      this.shotN[t] = i + 1;
    }
    for (let t = 0; t < this.shotMeshes.length; t++) {
      const im = this.shotMeshes[t];
      const n = this.shotN[t];
      // Boş kademe hiç çizilmiyor: gizleme matrisi yerine `count`, çünkü
      // sıfır örnekli bir çizim çağrısı da bir çizim çağrısıdır.
      im.count = n;
      im.visible = n > 0;
      if (n > 0) im.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ döngü

  render(s: State, ui: UiState, dt: number): void {
    this.t += dt;

    // Kazanınca kalabalık duvarın ötesine koşmaya devam ediyor: "yıktık ve
    // geçtik" hissi, olduğun yerde sevinmekten çok daha güçlü.
    // Geri sayımda kalabalık duruyor: sallanma da ayak sesi de yok, yoksa
    // yerinde koşuyormuş gibi oluyor ve başlangıç anı okunmuyor.
    const pre = s.pre > 0;
    const running = !pre && (s.status === 'playing' || s.status === 'won');
    this.bobAmount += ((running ? 0.06 : 0) - this.bobAmount) * Math.min(1, dt * 3);
    if (s.status === 'won') this.after = Math.min(this.after + dt * STRIKE.speed * 0.75, 9);
    const cz = s.z + this.after;
    this.lastX = s.x;
    this.lastZ = cz;

    // ŞERİT -> DÜNYA X. Kamera +Z'ye baktığı için dünya +X ekranda SOLA
    // düşüyor; durum ekran anlamını kullanıyor, çeviri burada yapılıyor.
    // ŞERİT -> DÜNYA X. Kamera +Z'ye baktığı için dünya +X ekranda SOLA
    // düşüyor; durum ekran anlamını kullanıyor, çeviri burada yapılıyor.
    // ELDEKİ SİLAH. Karttaki sayı ile koridordaki cisim ile karakterin
    // elindeki şey aynı olmalı; yükseltme ancak o zaman "elim değişti" diye
    // okunuyor. Geometri kademe değişince bir kez veriliyor, her kare değil.
    const tier = weaponTier(s.weapon);
    if (tier !== this.heldTier) {
      this.heldTier = tier;
      this.player.setHeld(this.weaponGeos[tier], WEAPONS[tier].len);
    }

    const crew = Math.min(s.crowd, STRIKE.crowdCap);
    for (let i = 0; i < crew; i++) {
      this.px0[i] = LANE * (s.x + offsetX(i));
      this.pz0[i] = cz + offsetZ(i);
    }
    this.player.updateAt(this.px0, this.pz0, crew, running ? dt : dt * 0.3);

    // HEDEF FİGÜRLERİ. Kırılmamış ve görüş alanındaki hedeflerin AYAKTA
    // KALAN figürleri yerleştiriliyor: can düştükçe saf eriyor.
    let n = 0;
    for (let e = 0; e < TRACK.length && n < STRIKE.foeCap; e++) {
      const ev = TRACK[e];
      if (ev.type !== 'target' || ev.boss) continue;
      const ts = s.targets[e];
      if (ts.broken) continue;
      if (ev.z < cz - 6 || ev.z > cz + 60) continue;
      const live = standing(ev, ts);
      // ÖLÜM GÖRÜNÜR OLMALI. Saf eriyordu ama figürler sessizce yok oluyordu:
      // can düşüyor, biri kayboluyor, ekranda hiçbir şey olmuyordu. Ayakta
      // kalan sayısı azaldığında AYRILANIN yerinde küçük bir patlama, o
      // erimeyi öldürmeye çeviriyor. İlk kare hariç (prev < 0), yoksa hedef
      // görüş alanına girdiği anda toplu patlama olurdu.
      const prev = this.wasStanding[e];
      if (prev >= 0 && live < prev) {
        for (let i = live; i < prev; i++) {
          const slot = targetSlot(ev, i);
          const [dx, dy] = this.worldScreen(LANE * slot.x, slot.z, CHAR_H * 0.8);
          this.fx.burst(dx, dy, this.L.w * 0.042, 0, '#8FE07A');
        }
      }
      this.wasStanding[e] = live;
      for (let i = 0; i < live && n < STRIKE.foeCap; i++) {
        const slot = targetSlot(ev, i);
        this.fx0[n] = LANE * slot.x;
        this.fz0[n] = slot.z;
        n++;
      }
    }
    this.foeSquad.updateAt(this.fx0, this.fz0, n, dt);

    // Patron: canı bitene kadar duruyor, bitince sahneden çıkıyor.
    const bi = TRACK.length - 1;
    const bev = TRACK[bi] as Target;
    if (!s.targets[bi].broken) {
      this.bx0[0] = 0;
      this.bz0[0] = bev.z;
      this.boss.updateAt(this.bx0, this.bz0, 1, dt);
    } else {
      if (!this.bossDown) {
        this.bossDown = true;
        const [bx, by] = this.worldScreen(0, bev.z, CHAR_H * 2);
        this.fx.burst(bx, by, this.L.w * 0.13, 8, '#FFD07A');
        this.fx.shake = this.L.w * 0.06;
        this.grade.pulse('#FFE6A8');
      }
      this.boss.updateAt(this.bx0, this.bz0, 0, dt);
    }

    this.updateShots(s);

    // Ayak sesi koşu temposuna kilitli.
    if (running) {
      this.stepAcc += dt;
      if (this.stepAcc > 0.27) {
        this.stepAcc = 0;
        if (this.onStep) this.onStep();
      }
    }

    if (this.smashT >= 0) {
      this.smashT += dt;
      for (const b of this.bricks) {
        const p = b.mesh.position;
        p.x += b.vx * dt;
        p.y += b.vy * dt - 4.6 * this.smashT * dt;
        p.z += b.vz * dt;
        b.mesh.rotation.z += b.spin * dt;
        b.mesh.rotation.x += b.spin * 0.6 * dt;
        if (p.y < -3) b.mesh.visible = false;
      }
    }

    this.placeCamera(s.x, cz);
    // Sarsıntı KAMERAYA uygulanıyor: 2D birimlerde HUD'u sallıyoruz ama
    // burada sarsılması gereken şey sahnenin kendisi.
    const [shx, shy] = this.fx.shakeOffset(dt);
    this.camera.position.x += shx * 0.006;
    this.camera.position.y += shy * 0.006;
    this.renderer.render(this.scene, this.camera);

    // Katman sırası: sahne (WebGL) -> atmosfer -> efekt -> arayüz.
    // Atmosfer arayüzün ÜSTÜNE gelse yazılar da kararırdı.
    const g2 = this.hudCtx;
    g2.clearRect(0, 0, this.L.w, this.L.h);
    this.grade.draw(g2, dt);
    this.fx.draw(g2, dt);
    // Can sayıları arayüzün ALTINDA: sayaç çipi ve CTA onların üstünde kalmalı.
    this.drawTargetHp(g2, s, cz);
    this.hud.draw(s, ui, dt);
  }
}
