/**
 * 3D görünüm — koridor, kalabalık, kapılar, duvar.
 *
 * RENK KİMLİĞİ ASSET'TEN ÇIKIYOR. Nature Kit'in kendi paleti naneye çalan
 * yeşiller, turuncu ahşap ve soluk mavi taş. Zemin ve gökyüzü ona göre
 * seçildi: sıcak şeftali bir gökyüzü, derin deniz yeşili bir zemin, kum rengi
 * bir patika. Kalabalığın dokusu neredeyse siyah — nane zeminin üstünde
 * siluetleri okunuyor, en çok ihtiyaç duyduğumuz şey de bu.
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
import { STRIKE, TRACK, TRACK_LEN, GATE_COLOR, Gate, Target, opLabel, opGood } from './config';
import { State, offsetX, offsetZ, targetSlot, standing } from './state';
import { Layout, UiState } from './layout';
import { Hud, bladeIcon } from './hud';
import { Fx } from '../../core/fx';
import { outlinedText } from '../../core/draw';

/** Arayüzle aynı yazı yığını — can sayıları HUD'un parçası gibi okunmalı. */
const FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
import { Squad, blobTexture } from './squad';
import { propClone, propSize } from './models';
import { RunView } from './view';
import { Grade } from './grade';

const SKY = '#FFF0DA';
// Zemin ve patika ilk sürümden daha doygun VE daha koyu.
//
// Doygunluk: solgun renkler "ucuz" okunuyor; bu görüntü türünün pahalı
// görünme biçimi temiz ve doygun renk.
//
// Koyuluk: zemin yatay bir düzlem, yani anahtar ışığı neredeyse tam alıyor.
// Malzemenin kendi rengini istediğin sonuca göre değil, IŞIKTAN SONRA
// istediğin sonuca göre seçmek gerekiyor — ilk denemede zemin ekranda
// bembeyaz çıktı.
// ÇİMEN AĞAÇTAN AYRILMALI. İlk sürümde çimen #1B9678 idi; palet dokusunu
// örnekleyince ağaçların yeşilinin #309870 / #188058 olduğu çıktı — ton
// açısı 157, çimeninki 156. Neredeyse aynı renk, o yüzden ağaçlar zeminden
// ayrışmıyordu. Çimen sarıya doğru çekildi (ton açısı 93), parlaklığı
// bilerek sabit tutuldu: zemin yatay olduğu için ana ışığın neredeyse
// tamamını alıyor ve açan her değer beyaza patlıyor.
const GROUND = '#5E9A2E';
const GRASS_DARK = '#4A7826';
const SAND = '#F3D9A2';
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
    grd.addColorStop(0, rnd() < 0.45 ? 'rgba(46,78,20,.22)' : 'rgba(34,58,14,.14)');
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

/** Patika dokusu: kum zemin + ileri bakan açık şeritler (hız hissi). */
function pathTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = SAND;
  g.fillRect(0, 0, 128, 128);

  // ENİNE GÖLGELEME. Karo yalnızca z ekseninde tekrar ediyor, yani soldan
  // sağa olan her şey patikanın KESİTİ demek. Kenarları koyulaştırmak
  // patikayı çime gömüyor; ortayı açmak da yıllardır basılan bir iz
  // izlenimi veriyor. Düz kum rengi bir şeritte ikisi de yoktu.
  const cross = g.createLinearGradient(0, 0, 128, 0);
  cross.addColorStop(0, 'rgba(96,60,26,.4)');
  cross.addColorStop(0.08, 'rgba(168,120,62,.16)');
  cross.addColorStop(0.36, 'rgba(255,244,214,.16)');
  cross.addColorStop(0.64, 'rgba(255,244,214,.16)');
  cross.addColorStop(0.92, 'rgba(168,120,62,.16)');
  cross.addColorStop(1, 'rgba(96,60,26,.4)');
  g.fillStyle = cross;
  g.fillRect(0, 0, 128, 128);

  // Çakıl ve toprak beneği.
  const rnd = lcg(1291);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 128;
    const y = rnd() * 128;
    const r = 1.2 + rnd() * 2.6;
    g.fillStyle = rnd() < 0.5 ? 'rgba(196,158,104,.36)' : 'rgba(255,246,224,.3)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
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
  /** Havadaki silahlar — hepsi tek InstancedMesh. */
  private shotMesh: InstancedMesh | null = null;
  private shotM = new Matrix4();
  private hideM = new Matrix4().makeScale(0, 0, 0);
  /** Yerleşim dizileri: her karede yeniden ayrılmasın diye alanda duruyor. */
  private fx0 = new Float32Array(STRIKE.foeCap);
  private fz0 = new Float32Array(STRIKE.foeCap);
  private px0 = new Float32Array(STRIKE.crowdCap);
  private pz0 = new Float32Array(STRIKE.crowdCap);
  private bx0 = new Float32Array(1);
  private bz0 = new Float32Array(1);
  private bossDown = false;
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
      'linear-gradient(180deg,#FF9F4D 0%,#FFBE72 8%,#FFDCA8 14%,' + SKY + ' 19%,' + SKY + ' 100%)';

    this.renderer = new WebGLRenderer({ canvas: gl, antialias: true, alpha: true });
    // Sis SADECE ufukta. Yakın başlayan sis orta planı da soldurüyordu.
    this.scene.fog = new Fog(new Color(SKY).getHex(), 76, 150);

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
    const key = new DirectionalLight(0xfff0cc, 1.15);
    key.position.set(-5, 7, -3);
    this.scene.add(key);
    // Dolgu KASTEN zayıf. Güçlü dolgu gölge tarafını da aydınlatıyor ve
    // formun yönü kayboluyor; sahne yine düz görünüyordu.
    const fill = new DirectionalLight(0x86B4FF, 0.28);
    fill.position.set(5.5, 2.5, 4);
    this.scene.add(fill);
    this.scene.add(new HemisphereLight(0xffe3b8, new Color(GROUND).getHex(), 0.34));

    this.buildGround();
    this.buildScenery();
    this.buildTrack();
    this.mergeStatic();
    this.buildSceneryShadows();

    this.player = new Squad({ h: CHAR_H, clip: 'sprint', cap: STRIKE.crowdCap, dust: true });
    this.scene.add(this.player.root);

    // DÜŞMANLAR OYUNCUNUN KENDİ KARAKTERİ. Konsept bu, ve bedeli sıfır:
    // aynı GLB, aynı instancing, tek fark dönüş açısı ve renk çarpanı.
    this.foeSquad = new Squad({
      h: CHAR_H, clip: 'idle', cap: STRIKE.foeCap, facing: Math.PI, tint: 0xffa898,
    });
    this.scene.add(this.foeSquad.root);

    // Patron aynı karakterin 2.9 katı. Dev bir model üretmek yerine ölçek:
    // blok karakterde bu kayıpsız çalışıyor, silüet zaten kutulardan oluşuyor.
    this.boss = new Squad({
      h: CHAR_H * 2.9, clip: 'idle', cap: 1, facing: Math.PI, tint: 0xff8f7a,
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
    const gt = grassTexture();
    gt.repeat.set(90 / 18, len / 18);
    const ground = new Mesh(new PlaneGeometry(90, len), new MeshLambertMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, len / 2 - 30);
    this.scene.add(ground);

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
    const trees = ['tree_pineRoundA', 'tree_pineTallA', 'tree_default'];
    const rocks = ['rock_tallB', 'rock_largeA'];
    const small = ['grass_leafs', 'flower_redA', 'mushroom_red', 'stump_round', 'rock_smallA'];
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
        const px = d * (STRIKE.halfW + 1.5 + rnd() * 5);
        const pz = z + rnd() * 3;
        g.position.set(px, 0, pz);
        g.rotation.y = rnd() * Math.PI * 2;
        this.statics.add(g);
        // Gölgenin genişliği modelin kendi eninden geliyor: ince bir çam ile
        // yayvan bir kaya aynı lekeyi bırakmamalı.
        const sz = propSize(name);
        this.spots.push([px, pz, sz ? (sz.x / (sz.y || 1)) * h * 1.5 : h]);
      }
      // ARKA SIRA AĞAÇLAR. Yakın plandaki tek sıra ağaç koridoru sarmıyordu;
      // yanlar boş yeşillik olarak kalıyor ve sahne derinliksiz duruyordu.
      // Uzağa daha İRİ ağaçlar koymak katman hissi veriyor. Hepsi aynı
      // malzemeleri paylaştığı için birleştirmeden sonra çizim çağrısına
      // hiçbir şey eklemiyorlar.
      for (const d of [-1, 1]) {
        if (rnd() > 0.82) continue;
        const far = propClone(trees[(rnd() * trees.length) | 0], 5.2 + rnd() * 3.4);
        if (!far) continue;
        far.position.set(d * (STRIKE.halfW + 7 + rnd() * 8), 0, z + rnd() * 5);
        far.rotation.y = rnd() * Math.PI * 2;
        this.statics.add(far);
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

      // Ara sıra çit kümesi: koridorun kenarını vurguluyor.
      if (rnd() < 0.24) {
        for (const d of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const f = propClone('fence_simple', 0.85);
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
   * Silahlar tek InstancedMesh.
   *
   * Model yok: fırlatılan şey ince, uzun bir kutu ve dönüyor. Bu ölçekte
   * bir balta modelinden ayırt edilmiyor, ama pakete tek bayt eklemiyor —
   * ve havada aynı anda yirmi tanesi olduğunda hepsi TEK çizim çağrısı.
   */
  private buildShots(): void {
    const geo = new BoxGeometry(0.72, 0.14, 0.22);
    const im = new InstancedMesh(
      geo,
      new MeshLambertMaterial({ color: new Color('#FFD45F'), emissive: 0x8a6a20 }),
      STRIKE.shotCap
    );
    im.frustumCulled = false;
    this.shotMesh = im;
    this.scene.add(im);
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
      this.hud.pop(x, y, 'BLADE ' + upgraded, '#FFD45F');
      this.fx.burst(x, y, this.L.w * 0.1, 7, '#FFD45F');
      this.grade.pulse('#FFE6A8');
    } else {
      this.fx.burst(x, y, this.L.w * 0.07, 4, '#FFD07A');
    }
  }

  finish(won: boolean): void {
    // Kazanınca klip DEĞİŞMİYOR: oyuncu koşarak barikatın içinden geçiyor.
    // Sevinme animasyonu koşuyla çelişiyordu — aynı anda hem koş hem zıpla.
    if (won) this.smashT = 0;
    else this.player.setClip('idle');
  }

  reset(): void {
    this.smashT = -1;
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
        bladeIcon(g, x, y - size * 0.92, size * 0.5);
        g.font = '900 ' + Math.round(size * 0.42) + 'px ' + FONT;
        outlinedText(g, '+' + ev.gives, x + size * 0.62, y - size * 0.86,
          Math.round(size * 0.42), '#FFD45F', '#FF9F45', 'rgba(16,12,20,.9)');
      }
      g.restore();
    }
  }

  /** Havadaki silahlar — konum + dönüş, hepsi tek InstancedMesh. */
  private updateShots(s: State): void {
    const im = this.shotMesh;
    if (!im) return;
    for (let i = 0; i < STRIKE.shotCap; i++) {
      if (i >= s.shots.length) {
        im.setMatrixAt(i, this.hideM);
        continue;
      }
      const sh = s.shots[i];
      this.shotM.makeRotationY(sh.spin);
      this.shotM.setPosition(LANE * sh.x, CHAR_H * 0.72, sh.z);
      im.setMatrixAt(i, this.shotM);
    }
    im.instanceMatrix.needsUpdate = true;
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
