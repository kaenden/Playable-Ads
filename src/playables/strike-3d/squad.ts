/**
 * Takım — aynı karakterden N tanesini birkaç çizim çağrısında oynatmak.
 *
 * Gate Crashers'taki kalabalık sınıfının aynısı, tek farkla: orada bütün
 * figürler TEK BİR MERKEZİN etrafında diziliyordu (kalabalık birlikte
 * koşuyor), burada her figürün kendi mutlak konumu var — düşman grupları
 * parkurun farklı yerlerinde duruyor ve tek tek ölüyorlar. O yüzden yerleşim
 * dışarıdan dizi olarak geliyor.
 *
 * İKİ AYRI MALİYET, ikisi de ayrı ayrı çözülüyor:
 *
 * 1) ANİMASYON HESABI. Ekrandaki herkes aynı klibi oynuyor, sadece farklı
 *    zamanda. Animasyon `STRIKE.phases` kez hesaplanıyor: üç "verici"
 *    karakter sahnede yok, sadece hesaplanıyor, ekrandaki her figür kendi
 *    fazının vericisinden pozunu alıyor. Tek faz robot ordusu gibi duruyor.
 *
 * 2) ÇİZİM ÇAĞRISI. Her VÜCUT PARÇASI tek bir InstancedMesh: bütün bacaklar
 *    tek çağrı, bütün gövdeler tek çağrı. Takım 1 kişi de olsa 40 kişi de
 *    olsa 6 çağrı + 1 gölge çağrısı.
 *
 * Bunu mümkün kılan şey animasyonun PARÇALI (kemiksiz) olması: her parça
 * katı bir cisim, yani her figürün her parçası sadece bir 4x4 matris.
 * Kemikli bir modelde deformasyon vertex seviyesinde olurdu ve bu numara
 * mümkün olmazdı.
 */
import {
  AnimationClip,
  AnimationMixer,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Euler,
  Quaternion,
  Vector3,
} from 'three';
import { STRIKE } from './config';
import { charClone, clipNamed } from './models';

/** Aynı anda havada duran toz bulutu sayısı. Hepsi tek çizim çağrısı. */
const DUST = 22;

interface Donor {
  group: Group;
  meshes: Mesh[];
  mixer: AnimationMixer;
}

function meshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) out.push(m);
  });
  return out;
}

/** Yumuşak kenarlı yuvarlak leke — gölge yerine geçiyor. */
export function blobTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  // Gölge rengi ZEMİNDEN geliyor. Gate Crashers'ta zemin yeşildi ve leke de
  // yeşile çalıyordu; burada zemin kum ve dolgu ışığı denizden geliyor, yani
  // gölge MOR-MAVİ. Kahverengi bir leke kumun üstünde kir gibi duruyordu.
  // Gölge SAYDAM BOYA, ve saydam boya doygunluk düşürür. Kalabalık artı
  // süsler ekranda yüzlerce leke demek; mor-mavi ve %42'de bunlar altın
  // zemini tek başına soldurüyordu. Daha açık ve zeminin kendi ailesine
  // yakın bir gölge hem gölge kalıyor hem rengi yemiyor.
  grd.addColorStop(0, 'rgba(92,78,52,.34)');
  grd.addColorStop(0.55, 'rgba(92,78,52,.18)');
  grd.addColorStop(1, 'rgba(92,78,52,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(cv);
}

export interface SquadOpts {
  /** Figür boyu (dünya birimi). */
  h: number;
  clip: string;
  /** Aynı anda çizilebilecek en fazla figür. */
  cap: number;
  /** Y ekseni dönüşü. Düşmanlar oyuncuya bakıyor, yani PI. */
  facing?: number;
  /**
   * Doku rengini çarpan renk.
   *
   * Düşmanlar OYUNCUNUN KENDİ KARAKTERİ — konsept bu. Ama birebir aynı
   * görünürlerse ekranda kim kim belli olmuyor. Kırmızıya çalan bir çarpan
   * dokuyu koruyup tarafı ayırıyor; yeni bir model üretmeye gerek kalmıyor.
   */
  tint?: number;
  /** Ayak tozu — sadece koşan oyuncu kaldırıyor. */
  dust?: boolean;
  /** Elde silah taşıyabilsin mi. Sadece oyuncu takımı taşıyor. */
  held?: boolean;
  /**
   * Hangi karakter modeli. Boş bırakılırsa oyuncunun korsanı.
   *
   * Düşmanlar önce aynı modeldi ve sadece kırmızıya boyanıyordu; ekranda
   * "aynı adam, başka renk" okunuyordu. Paket 18 karakter taşıyor, ikincisini
   * almak bedava: düşmanlar artık zombi.
   */
  model?: string;
  /**
   * Yerinde süzülme genliği (dünya birimi).
   *
   * Bekleme klibi çok sakin; düşman safı ekranda dümdüz ve cansız duruyordu.
   * Her figüre KENDİ FAZINDA küçük bir dikey salınım vermek safı canlandırıyor
   * ve hiçbir şeye mal olmuyor: zaten her kare yazılan matrisin y bileşeni.
   */
  bob?: number;
}

/**
 * ELDEKİ SİLAHIN KAVRAMA AYARLARI.
 *
 * Silah, karakterin SAĞ KOL parçasına bağlanıyor: konumu koldan geliyor, yani
 * gövde koşarken zıpladıkça silah da zıplıyor ve ayrıca animasyon yazmaya
 * gerek kalmıyor.
 *
 * Ölçek 1'in altında: silah havadakiyle aynı model ama elde birebir boyda
 * durunca çift ağızlı balta karakter kadar oluyor ve gövdeye giriyor.
 */
/**
 * KAVRAMA: SAP ELDE, UÇ DIŞARIDA.
 *
 * İki tur sürdü. Önce silah neredeyse dikti ve omza saplanmış gibi
 * duruyordu. Sonra yana devirdim ama YANLIŞ YÖNE: dönüş açısı negatifti,
 * yani silahın ucu gövdenin üstüne, SAPI dışarı düşüyordu — elde tutulan
 * değil, koltuk altına sıkıştırılmış bir şey gibi.
 *
 * `GRIP_ROLL` artık pozitif ve dik açının biraz ötesinde: silahın +Y ekseni
 * (namlusu) dışarı ve hafif aşağı bakıyor, sap ise elin içinde kalıyor.
 * Kamera arkadan baktığı için bu, silahın tam boyunun okunduğu duruş.
 */
const HAND_OUT = -0.12;
const HAND_DROP = 0.2;
const HAND_FWD = 0.02;
const GRIP_TILT = -0.12;
const GRIP_ROLL = 1.75;
const HELD_SCALE = 0.85;
/**
 * Kolun dönüşü ne kadar geçiyor. 0 = silah kolun her savruluşunu izliyor,
 * 1 = taş gibi sabit.
 *
 * İlk sürüm 0'dı ve büyük silahlar koşu sırasında gövdenin içinden geçip
 * yatay yatıyordu — kol koşarken neredeyse doksan derece savruluyor. 0.78,
 * silahın elde durduğu belli olacak kadar oynamasını bırakıyor ama duruşunu
 * kaybettirmiyor.
 */
const HAND_DAMP = 0.78;

export class Squad {
  readonly root = new Group();
  private donors: Donor[] = [];
  private parts: InstancedMesh[] = [];
  private shadows: InstancedMesh | null = null;
  private dust: InstancedMesh | null = null;
  private puffs = new Float32Array(DUST * 4);
  private puffNext = 0;
  private dustAcc = 0;
  private m = new Matrix4();
  private place = new Matrix4();
  private hide = new Matrix4().makeScale(0, 0, 0);
  private cap: number;
  private ok = false;
  private bob = 0;
  private time = 0;
  /** Eldeki silah: tek InstancedMesh, geometrisi yükseltmede değişiyor. */
  private heldMesh: InstancedMesh | null = null;
  private wantHeld = false;
  /** Silahın bağlandığı parçanın indeksi — adla bulunuyor, sırayla değil. */
  private armIdx = -1;
  private grip = new Matrix4();
  private held = new Matrix4();
  private p = new Vector3();
  private q = new Quaternion();
  private sc = new Vector3();
  private one = new Vector3(1, 1, 1);
  /** Silahın sabit duruşu — kolun dönüşü buna doğru sönümleniyor. */
  private rest = new Quaternion().setFromEuler(new Euler(GRIP_TILT, 0, GRIP_ROLL));

  constructor(o: SquadOpts) {
    this.cap = o.cap;
    this.wantHeld = !!o.held;
    this.bob = o.bob || 0;
    const clip = clipNamed(o.clip);
    for (let p = 0; p < STRIKE.phases; p++) {
      const g = charClone(o.h, o.model);
      if (!g || !clip) break;
      g.rotation.y = o.facing ?? 0;
      const mixer = new AnimationMixer(g);
      const act = mixer.clipAction(clip);
      act.play();
      act.time = (clip.duration * p) / STRIKE.phases;
      mixer.update(0);
      g.updateMatrixWorld(true);
      this.donors.push({ group: g, meshes: meshesOf(g), mixer });
    }
    if (!this.donors.length) return;

    // Kol parçasını ADLA bul, sırayla değil: paketteki parça sırası değişirse
    // silah kafaya ya da bacağa bağlanmasın.
    this.armIdx = this.donors[0].meshes.findIndex((m) => m.name.indexOf('arm-right') === 0);

    // YARI IŞIKLI MALZEME. Paket karakteri unlit geliyor — hiç ışık almıyor,
    // her yüzeyi aynı parlaklıkta, ve kalabalıkta bu tek bir koyu leke gibi
    // görünüyor. Sadece Lambert'e geçmek de çalışmadı: doku zaten koyu,
    // üstüne ışık çarpanı binince figürler silüet olmaktan çıkıp leke oldu.
    // Dokuyu aynı zamanda IŞIYAN harita olarak vermek tabanı koruyor —
    // figür kendi renginin %40'ının altına inmiyor, ışık ÜSTÜNE form ekliyor.
    const tint = o.tint === undefined ? null : new Color(o.tint);
    for (const proto of this.donors[0].meshes) {
      const src = proto.material as MeshBasicMaterial;
      const base = tint ? src.color.clone().multiply(tint) : src.color;
      const mat = new MeshLambertMaterial({
        map: src.map || null,
        color: base,
        // Işıyan taban 0x666666 -> 0x7d7d7d: figürler gölgede fazla
        // kararıyordu. Doku zaten neredeyse siyah, tabanı yükseltmek
        // siluetin canlı kalmasını sağlıyor.
        emissive: tint ? new Color(0x7d7d7d).multiply(tint) : new Color(0x7d7d7d),
        emissiveMap: src.map || null,
      });
      mat.name = src.name;
      const im = new InstancedMesh(proto.geometry, mat as Material, this.cap);
      // Örnekler her kare hareket ediyor; sınır küresini peşinden koşturmak
      // yerine kırpmayı kapatıyoruz.
      im.frustumCulled = false;
      this.parts.push(im);
      this.root.add(im);
    }

    const geo = new PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const sm = new InstancedMesh(
      geo,
      new MeshBasicMaterial({
        map: blobTexture(),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
      this.cap
    );
    sm.frustumCulled = false;
    sm.renderOrder = -1;
    this.shadows = sm;
    this.root.add(sm);

    if (o.dust) {
      // AYAK TOZU. Koşan figürün en çok eksik olan şeyi buydu: hareket
      // ediyordu ama ZEMİNLE hiçbir alışverişi yoktu, kaydırılan bir katman
      // gibi duruyordu. Saydamlık örnek başına ayarlanamıyor (malzeme tek),
      // o yüzden sönme ÖLÇEKLE yapılıyor: bulut küçülerek yok oluyor.
      const dgeo = new PlaneGeometry(1, 1);
      dgeo.rotateX(-Math.PI / 2);
      const dm = new InstancedMesh(
        dgeo,
        new MeshBasicMaterial({
          map: blobTexture(),
          color: 0xf2e2b8,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
        DUST
      );
      dm.frustumCulled = false;
      dm.renderOrder = -1;
      this.dust = dm;
      this.root.add(dm);
      for (let i = 0; i < DUST; i++) this.puffs[i * 4 + 3] = 2;
    }

    this.ok = true;
  }

  get available(): boolean {
    return this.ok;
  }

  /**
   * Takımın eline silah ver.
   *
   * Bütün takım AYNI silahı taşıyor, o yüzden tek InstancedMesh yetiyor ve
   * yükseltmede sadece geometrisi değişiyor — kademe başına ayrı mesh tutmaya
   * gerek yok. `len` kavrama noktasını hesaplamak için: silahın merkezi
   * elden yukarı, kendi boyunun üçte biri kadar kaydırılıyor ki sap avuçta
   * kalsın, ortası değil.
   */
  setHeld(geo: BufferGeometry | null, len: number): void {
    if (!this.ok || !this.wantHeld || this.armIdx < 0) return;
    if (!geo) {
      if (this.heldMesh) this.heldMesh.visible = false;
      return;
    }
    if (!this.heldMesh) {
      const im = new InstancedMesh(
        geo,
        new MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2a30 }),
        this.cap
      );
      im.frustumCulled = false;
      this.heldMesh = im;
      this.root.add(im);
    } else {
      this.heldMesh.geometry = geo;
    }
    this.heldMesh.visible = true;
    // Kavrama: silahı ölçekle, sonra kendi boyunun üçte biri kadar yukarı
    // kaydır ki AVUÇTA sapı dursun, ortası değil. Yön ve el konumu her karede
    // koldan geliyor, burada değil.
    // 0.34 -> 0.26: silahın merkezi elden daha AZ yukarıda, yani sap avuçta
    // kalırken ağırlık aşağı iniyor.
    this.grip.makeTranslation(0, len * HELD_SCALE * 0.26, 0);
    this.m.makeScale(HELD_SCALE, HELD_SCALE, HELD_SCALE);
    this.grip.multiply(this.m);
  }

  /**
   * @param xs DÜNYA x konumları (şerit çevirisi çağıranda yapılıyor)
   * @param zs dünya z konumları
   * @param n  kaç tanesi geçerli
   */
  updateAt(xs: Float32Array, zs: Float32Array, n: number, dt: number): void {
    if (!this.ok) return;
    this.time += dt;
    for (const d of this.donors) {
      d.mixer.update(dt);
      // Vericiler sahnede olmadığı için matrislerini three kendiliğinden
      // güncellemiyor; poz buradan okunuyor.
      d.group.updateMatrixWorld(true);
    }

    const live = Math.min(n, this.cap);
    for (let i = 0; i < this.cap; i++) {
      if (i >= live) {
        for (const im of this.parts) im.setMatrixAt(i, this.hide);
        if (this.shadows) this.shadows.setMatrixAt(i, this.hide);
        if (this.heldMesh) this.heldMesh.setMatrixAt(i, this.hide);
        continue;
      }
      // Faz İNDEKSTEN geliyor: aynı anda inip kalkan bir saf robot ordusu
      // gibi duruyor, dağınık faz kalabalık gibi.
      const y = this.bob ? Math.sin(this.time * 2.6 + i * 1.7) * this.bob : 0;
      this.place.makeTranslation(xs[i], y, zs[i]);
      const d = this.donors[i % this.donors.length];
      for (let k = 0; k < this.parts.length; k++) {
        const src = d.meshes[k];
        if (!src) continue;
        this.m.multiplyMatrices(this.place, src.matrixWorld);
        this.parts[k].setMatrixAt(i, this.m);
      }
      if (this.heldMesh) {
        // EL KOLDAN, DURUŞ SABİTTEN. Kolun matrisi ÖLÇEK de taşıyor (karakter
        // boyu dış grupta veriliyor), o yüzden ölçek atılıyor: silah kendi
        // dünya ölçüsünde çizilmeli. Dönüş ise kolunkine tam uymuyor,
        // duruşa doğru sönümleniyor — sebebi HAND_DAMP'ta.
        this.m.multiplyMatrices(this.place, d.meshes[this.armIdx].matrixWorld);
        this.m.decompose(this.p, this.q, this.sc);
        this.q.slerp(this.rest, HAND_DAMP);
        this.p.x += HAND_OUT;
        this.p.y -= HAND_DROP;
        this.p.z += HAND_FWD;
        this.held.compose(this.p, this.q, this.one);
        this.held.multiply(this.grip);
        this.heldMesh.setMatrixAt(i, this.held);
      }
      if (this.shadows) {
        // Gölge YERDE kalıyor ve süzülen figürle birlikte hafifçe küçülüyor:
        // yükselen bir cismin gölgesi büyümez, dağılır.
        const k = 0.62 - y * 0.5;
        this.m.makeScale(k, 1, k);
        this.m.setPosition(xs[i], 0.02, zs[i]);
        this.shadows.setMatrixAt(i, this.m);
      }
    }
    for (const im of this.parts) im.instanceMatrix.needsUpdate = true;
    if (this.shadows) this.shadows.instanceMatrix.needsUpdate = true;
    if (this.heldMesh) this.heldMesh.instanceMatrix.needsUpdate = true;
    if (this.dust && live > 0) this.updateDust(xs[0], zs[0], dt);
  }

  private updateDust(x: number, z: number, dt: number): void {
    const dm = this.dust;
    if (!dm) return;
    this.dustAcc += dt * 7;
    while (this.dustAcc > 1) {
      this.dustAcc -= 1;
      const i = this.puffNext;
      this.puffNext = (this.puffNext + 1) % DUST;
      this.puffs[i * 4] = x + (Math.random() - 0.5) * 0.4;
      this.puffs[i * 4 + 1] = 0.05;
      this.puffs[i * 4 + 2] = z - 0.3;
      this.puffs[i * 4 + 3] = 0;
    }
    for (let i = 0; i < DUST; i++) {
      let age = this.puffs[i * 4 + 3];
      if (age >= 1) {
        dm.setMatrixAt(i, this.hide);
        continue;
      }
      age += dt * 1.5;
      this.puffs[i * 4 + 3] = age;
      // Toz geride kalıyor: figür ilerlerken bulut yerinde duruyor.
      this.puffs[i * 4 + 1] += dt * 0.35;
      const grow = 0.3 + age * 0.8;
      const fade = age < 0.25 ? age / 0.25 : 1 - (age - 0.25) / 0.75;
      const sz = grow * Math.max(0, fade);
      this.m.makeScale(sz, 1, sz);
      this.m.setPosition(this.puffs[i * 4], this.puffs[i * 4 + 1], this.puffs[i * 4 + 2]);
      dm.setMatrixAt(i, this.m);
    }
    dm.instanceMatrix.needsUpdate = true;
  }

  setClip(name: string): void {
    const clip: AnimationClip | null = clipNamed(name);
    if (!clip) return;
    for (const d of this.donors) {
      d.mixer.stopAllAction();
      d.mixer.clipAction(clip).play();
    }
  }
}
