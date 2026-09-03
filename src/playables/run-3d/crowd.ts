/**
 * Kalabalık — 30 karakteri 7 çizim çağrısında oynatmak.
 *
 * İKİ AYRI MALİYET VAR ve ikisi de ayrı ayrı çözülüyor.
 *
 * 1) ANİMASYON HESABI. Ekrandaki herkes AYNI koşuyu oynuyor, sadece ayakları
 *    farklı zamanda yere basıyor. O yüzden animasyon sadece birkaç kez
 *    hesaplanıyor (RUN.phases = 3): üç "verici" karakter sahnede yok, sadece
 *    hesaplanıyor. Ekrandaki her adam kendi fazının vericisinden pozunu
 *    alıyor. Tek faz denendi ve robot ordusu gibi duruyordu; üç faz yetiyor.
 *
 * 2) ÇİZİM ÇAĞRISI. İlk sürümde her adam ayrı bir kopyaydı: 26 adam × 6 parça
 *    = 156 çizim çağrısı, sahnenin toplamı 337. Mobilde bu tek başına kare
 *    süresini yiyor. Şimdi her VÜCUT PARÇASI tek bir InstancedMesh: bütün
 *    bacaklar tek çağrı, bütün gövdeler tek çağrı. Kalabalık 5 kişi de olsa
 *    30 kişi de olsa 6 çağrı + 1 gölge çağrısı.
 *
 * Bunu mümkün kılan şey animasyonun PARÇALI (kemiksiz) olması: her parça
 * kendi başına katı bir cisim, yani her adamın her parçası sadece bir 4x4
 * matris. Kemikli bir modelde aynı numara mümkün değildi — orada deformasyon
 * vertex seviyesinde ve her karakterin kendi iskelet matrisleri olurdu.
 *
 * GÖLGELER de tek InstancedMesh. Gerçek gölge haritası bu ölçekte lüks:
 * mobilde tek başına kare süresinin yarısını yiyor.
 */
import {
  AnimationClip,
  AnimationMixer,
  CanvasTexture,
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
} from 'three';
import { RUN } from './config';
import { offsetX, offsetZ } from './state';
import { charClone, clipNamed } from './models';

/** Paketin karakteri +Z'ye bakıyor; parkur da +Z'ye gidiyor. */
const FACE = 0;

/** Aynı anda havada duran toz bulutu sayısı. Hepsi tek çizim çağrısı. */
const DUST = 28;

interface Donor {
  group: Group;
  /** Vücut parçalarının mesh düğümleri — sıra bütün vericilerde aynı. */
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

/** Yumuşak kenarlı yuvarlak leke — gölge yerine geçiyor. Süs gölgeleri de
 *  aynı dokuyu kullanıyor (view3d), iki kez üretmenin anlamı yok. */
export function blobTexture(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(18,42,36,.5)');
  grd.addColorStop(0.55, 'rgba(18,42,36,.26)');
  grd.addColorStop(1, 'rgba(18,42,36,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(cv);
}

export class Crowd {
  /** Sahneye eklenecek kök — çağıran ekliyor. */
  readonly root = new Group();
  private donors: Donor[] = [];
  private parts: InstancedMesh[] = [];
  private shadows: InstancedMesh | null = null;
  private dust: InstancedMesh | null = null;
  /** Her toz bulutu: x, y, z, yaş. Yaşı 1'i geçen yeniden kullanılıyor. */
  private puffs: Float32Array = new Float32Array(DUST * 4);
  private puffNext = 0;
  private dustAcc = 0;
  private m = new Matrix4();
  private place = new Matrix4();
  private hide = new Matrix4().makeScale(0, 0, 0);
  private ok = false;

  /** `h` = karakter boyu (dünya birimi). */
  constructor(h: number, clipName: string) {
    const clip = clipNamed(clipName);
    for (let p = 0; p < RUN.phases; p++) {
      const g = charClone(h);
      if (!g || !clip) break;
      g.rotation.y = FACE;
      const mixer = new AnimationMixer(g);
      const act = mixer.clipAction(clip);
      act.play();
      // Fazları klibin süresine eşit dağıt.
      act.time = (clip.duration * p) / RUN.phases;
      mixer.update(0);
      g.updateMatrixWorld(true);
      this.donors.push({ group: g, meshes: meshesOf(g), mixer });
    }
    if (!this.donors.length) return;

    // KALABALIK IŞIK ALSIN.
    //
    // Paket karakteri unlit geliyor: hiç ışık almıyor, her yüzeyi aynı
    // parlaklıkta. Kalabalıkta bu, otuz kişinin tek bir koyu leke gibi
    // görünmesine yol açıyordu — omuz nerede biter kafa nerede başlar
    // okunmuyordu. Aynı dokuyla ışık alan bir malzemeye geçince üstler
    // sıcak, yanlar soğuk oluyor ve her figürün hacmi ayrılıyor.
    for (const proto of this.donors[0].meshes) {
      const src = proto.material as MeshBasicMaterial;
      // YARI IŞIKLI. Sadece Lambert'e geçince kalabalık koyulaştı: karakterin
      // dokusu zaten koyu, üstüne bir de ışık çarpanı binince figürler
      // silüet olmaktan çıkıp leke oldu. Dokuyu aynı zamanda IŞIYAN harita
      // olarak vermek tabanı koruyor — figür hiçbir zaman kendi renginin
      // %40'ının altına düşmüyor, ışık onun ÜSTÜNE form ekliyor.
      const mat = new MeshLambertMaterial({
        map: src.map || null,
        color: src.color,
        emissive: 0x666666,
        emissiveMap: src.map || null,
      });
      mat.name = src.name;
      const im = new InstancedMesh(proto.geometry, mat as Material, RUN.renderCap);
      // Örnekler her kare hareket ediyor; sınır küresini peşinden koşturmak
      // yerine kırpmayı kapatıyoruz. Kalabalık zaten hep kamera önünde.
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
      RUN.renderCap
    );
    sm.frustumCulled = false;
    sm.renderOrder = -1;
    this.shadows = sm;
    this.root.add(sm);

    // AYAK TOZU. Koşan kalabalığın en çok eksik olan şeyi buydu: figürler
    // hareket ediyordu ama ZEMİNLE hiçbir alışverişleri yoktu, kaydırılan
    // bir katman gibi duruyorlardı. Aynı yumuşak leke, kalabalığın arkasında
    // büyüyüp sönen bulutlar olarak — yine tek çizim çağrısı.
    //
    // Saydamlık örnek başına ayarlanamıyor (malzeme tek), o yüzden sönme
    // ÖLÇEKLE yapılıyor: bulut küçülerek yok oluyor. Yumuşak kenarlı bir
    // lekede bu, saydamlıkla sönmekten ayırt edilmiyor.
    const dgeo = new PlaneGeometry(1, 1);
    dgeo.rotateX(-Math.PI / 2);
    const dm = new InstancedMesh(
      dgeo,
      new MeshBasicMaterial({
        map: blobTexture(),
        color: 0xd8c49a,
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

    this.ok = true;
  }

  get available(): boolean {
    return this.ok;
  }

  /**
   * @param cx kalabalığın merkezi — ŞERİT koordinatı (artı yön ekranda sağ)
   * @param cz kalabalığın merkezi (z)
   * @param count kalabalık sayısı
   *
   * Şerit -> dünya X işaret çevirisi burada yapılıyor; sebebi view3d.ts'te.
   */
  update(cx: number, cz: number, count: number, dt: number): void {
    if (!this.ok) return;
    for (const d of this.donors) {
      d.mixer.update(dt);
      // Vericiler sahnede olmadığı için matrislerini three kendiliğinden
      // güncellemiyor; poz buradan okunuyor.
      d.group.updateMatrixWorld(true);
    }

    const n = Math.min(count, RUN.renderCap);
    for (let i = 0; i < RUN.renderCap; i++) {
      if (i >= n) {
        for (const im of this.parts) im.setMatrixAt(i, this.hide);
        if (this.shadows) this.shadows.setMatrixAt(i, this.hide);
        continue;
      }
      const px = -(cx + offsetX(i));
      const pz = cz + offsetZ(i);
      this.place.makeTranslation(px, 0, pz);

      const d = this.donors[i % this.donors.length];
      for (let k = 0; k < this.parts.length; k++) {
        const src = d.meshes[k];
        if (!src) continue;
        this.m.multiplyMatrices(this.place, src.matrixWorld);
        this.parts[k].setMatrixAt(i, this.m);
      }
      if (this.shadows) {
        this.m.makeScale(0.62, 1, 0.62);
        this.m.setPosition(px, 0.02, pz);
        this.shadows.setMatrixAt(i, this.m);
      }
    }
    for (const im of this.parts) im.instanceMatrix.needsUpdate = true;
    if (this.shadows) this.shadows.instanceMatrix.needsUpdate = true;
    this.updateDust(cx, cz, n, dt);
  }

  private updateDust(cx: number, cz: number, n: number, dt: number): void {
    const dm = this.dust;
    if (!dm) return;

    // Kalabalık büyüdükçe toz da artıyor — 30 kişilik bir ordu 5 kişiden
    // daha fazla toz kaldırmalı.
    this.dustAcc += dt * (2 + n * 0.5);
    while (this.dustAcc > 1 && n > 0) {
      this.dustAcc -= 1;
      const i = this.puffNext;
      this.puffNext = (this.puffNext + 1) % DUST;
      const who = (Math.random() * n) | 0;
      this.puffs[i * 4] = -(cx + offsetX(who)) + (Math.random() - 0.5) * 0.3;
      this.puffs[i * 4 + 1] = 0.05;
      this.puffs[i * 4 + 2] = cz + offsetZ(who) - 0.25;
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
      // Toz geride kalıyor: kalabalık ilerlerken bulut yerinde duruyor.
      this.puffs[i * 4 + 1] += dt * 0.35;
      const grow = 0.35 + age * 0.9;
      const fade = age < 0.25 ? age / 0.25 : 1 - (age - 0.25) / 0.75;
      const sz = grow * Math.max(0, fade);
      this.m.makeScale(sz, 1, sz);
      this.m.setPosition(this.puffs[i * 4], this.puffs[i * 4 + 1], this.puffs[i * 4 + 2]);
      dm.setMatrixAt(i, this.m);
    }
    dm.instanceMatrix.needsUpdate = true;
  }

  /** Kaybedince koşuyu bırakıp başka bir klibe geç. */
  setClip(name: string): void {
    const clip: AnimationClip | null = clipNamed(name);
    if (!clip) return;
    for (const d of this.donors) {
      d.mixer.stopAllAction();
      d.mixer.clipAction(clip).play();
    }
  }
}
