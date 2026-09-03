/**
 * Model dokusu — GLB'nin YANINDA taşınan tek görsel.
 *
 * NEDEN AYRI TAŞINIYOR
 *
 * Doku GLB'nin İÇİNDE gömülü geldiğinde reklam kutusunda YÜKLENMİYOR:
 * GLTFLoader gömülü görseli okumak için geçici bir blob adresi üretip ağ
 * isteği yapıyor, container'ın güvenlik kuralı (CSP `connect-src`) onu
 * reddediyor ve model dokusuz kalıyor. Ekranda görünen: bütün nesneler
 * renksiz. Konsolda görünen: `THREE.GLTFLoader: Couldn't load texture blob:`
 *
 * Bu bir artifact tuhaflığı değil — ağ container'ları da aynı şekilde
 * kısıtlıyor, yani sahada da patlardı.
 *
 * Çözüm: hat dokuyu GLB'den çıkarıp yanında ayrı taşıyor, burada `<img>` ve
 * data URI ile yükleniyor. Bu yol ağ isteği değil; 2D atlas da aynı yoldan
 * yükleniyor ve kutuda sorunsuz çalışıyor.
 *
 * İKİ TÜR DOKU, İKİ FİLTRE
 *
 * 1. KARTELA (Kenney 3D kitleri — araba, yiyecek): modeller renkli değil,
 *    hepsi tek bir küçük renk kartelasını paylaşıyor ve her yüzeyin UV'si
 *    kartelanın içindeki minik bir kareye bakıyor. Onlarca model 2 KB'lık tek
 *    dosyayla renkleniyor. Burada mipmap ve linear filtre komşu renk
 *    karelerini harmanlıyor; nesne küçüldükçe kartelanın ORTALAMASI okunuyor,
 *    yani gri. Doğru okuma: en yakın komşu, mipmap kapalı.
 *
 * 2. YÜZEY HARİTASI (karakter dokusu): gerçek bir 512px doku, geniş düz renk
 *    alanları. Burada tam tersi geçerli — mipmapsiz karakter uzaklaştıkça
 *    titriyor. `smooth` bayrağı bu ayrımı yapıyor.
 *
 * HANGİ MALZEMEYE BAĞLANACAĞI
 *
 * Runner sahnesinde iki tür malzeme yan yana: karakterin dokulu malzemesi ve
 * Nature Kit'in düz renkli ağaç/kaya malzemeleri. Ayrım yapmadan hepsine
 * bağlayınca ağaçlar da karakter dokusunu giyiyor. Hat, dokuyu SÖKERKEN o
 * malzemelerin adını `palette:` ile işaretliyor; burada sadece işaretliler
 * boyanıyor.
 */
import {
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  NearestFilter,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';

interface WithMap extends Material {
  map?: Texture | null;
  needsUpdate: boolean;
}

/** Hat, dokusunu söktüğü malzemenin adına bu öneki koyuyor. */
const MARK = 'palette:';

/** base64'ün ilk baytları formatı söylüyor; uzantı bilgisi bundle'a gelmiyor. */
function mimeOf(b64: string): string {
  if (b64.indexOf('UklGR') === 0) return 'image/webp';
  if (b64.indexOf('iVBORw0KGgo') === 0) return 'image/png';
  return 'image/png';
}

/**
 * Dokuyu data URI'den yükler. Yüklenemezse null döner ve model sabit
 * renginde kalır — beyaz model, boş ekrandan iyidir.
 *
 * `smooth`: gerçek yüzey haritası (mipmap açık). Varsayılan kartela.
 */
export function loadPalette(smooth?: boolean): Promise<Texture | null> {
  if (!__PALETTE_B64__) return Promise.resolve(null);
  return new Promise<Texture | null>((res) => {
    const im = new Image();
    im.onload = () => {
      const t = new Texture(im);
      // glTF UV'leri yukarıdan aşağı; three'nin varsayılan çevirmesi
      // dokuyu ters okutup yanlış yeri seçtiriyor.
      t.flipY = false;
      t.colorSpace = SRGBColorSpace;
      // Kenney kitlerinin UV'leri 0-1 aralığının DIŞINA taşıyor (hattaki
      // "Skipping TEXCOORD_0; out of [0,1] range" uyarısı tam olarak bunu
      // söylüyordu). Elle kurulan doku varsayılan olarak kenara kırpıyor ve
      // kenar pikseli siyah — bütün modeller simsiyah çıkıyordu.
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.magFilter = NearestFilter;
      t.minFilter = smooth ? LinearMipmapLinearFilter : NearestFilter;
      t.generateMipmaps = !!smooth;
      t.needsUpdate = true;
      res(t);
    };
    im.onerror = () => res(null);
    im.src = 'data:' + mimeOf(__PALETTE_B64__) + ';base64,' + __PALETTE_B64__;
  });
}

/** Dokuyu SADECE hattın işaretlediği malzemelere bağlar. */
export function applyPalette(root: Object3D, tex: Texture | null): void {
  if (!tex) return;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if ((mat.name || '').indexOf(MARK) !== 0) continue;
      const w = mat as WithMap;
      w.map = tex;
      w.needsUpdate = true;
    }
  });
}

/**
 * Doku GLB'nin içinden geldiyse (yerel geliştirme, eski çıktı) filtrelerini
 * düzeltir. Ayrı taşınan doku varken buna gerek kalmıyor ama iki yol da
 * çalışır kalsın.
 */
export function fixPaletteTextures(root: Object3D): void {
  const seen: Texture[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const tex = (mat as WithMap).map;
      if (!tex || seen.indexOf(tex) >= 0) continue;
      seen.push(tex);
      tex.magFilter = NearestFilter;
      tex.minFilter = NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
    }
  });
}
