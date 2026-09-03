/**
 * 3D asset optimizasyon hattı — "müşteriden gelen GLB"yi playable'a sığdırır.
 *
 *   node build/assets-3d.mjs            assets-lab/in-3d/*.glb işler
 *   node build/assets-3d.mjs --tris 4000 --tex 512
 *
 * Neden bu adımlar: Draco ve KTX2'yi ölçtük ve playable ölçeğinde ZARARDA
 * çıktılar (03-3D-ASSET-EXPERIMENT.md) çünkü decoder'ın kendisi de inline
 * olmak zorunda. Bu hat DECODER GEREKTİRMEYEN kaldıraçları kullanıyor:
 *
 *   KHR_mesh_quantization  -> vertex verisi float32 yerine int16/int8.
 *                             three.js GLTFLoader'da yerleşik, ek dosya yok.
 *   EXT_texture_webp       -> texture WebP. Tarayıcı natively açıyor,
 *                             KTX2'nin 761 KB'lık transcoder'ı gerekmiyor.
 *   simplify (meshopt)     -> üçgen sayısını düşürür; veri azaltmak
 *                             sıkıştırmaktan her zaman daha ucuz.
 *
 * Karşılaştırma için Draco varyantı da üretilip decoder maliyetiyle birlikte
 * raporlanıyor.
 */
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, quantize, textureCompress, draco, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.indexOf(k) >= 0 ? +argv[argv.indexOf(k) + 1] : d);
const argS = (k, d) => (argv.indexOf(k) >= 0 ? argv[argv.indexOf(k) + 1] : d);

// 2D hattında olduğu gibi: her playable kendi asset klasörüyle çalışıyor.
const IN = join(ROOT, 'assets-lab', argS('--in', 'in-3d'));
const OUT = join(ROOT, 'assets-lab', argS('--out', 'out-3d'));
const TRI_BUDGET = arg('--tris', 4000);
const TEX_SIZE = arg('--tex', 512);
/** --basecolor: normal/AO/metallicRoughness/emissive haritalarını at. */
const BASECOLOR = argv.includes('--basecolor');
/**
 * --palette : doku bir RENK KARTELASI, fotoğraf değil -> KÜÇÜLTME.
 *
 * Kenney'nin 3D kitlerinde modeller renkli değil; hepsi tek bir küçük
 * karteladan renk seçiyor. Böyle bir dokuya normal doku muamelesi yapmak
 * (küçültmek + kayıplı sıkıştırmak) komşu renk karelerini birbirine
 * bulaştırıyor ve nesneler ekranda cansız gri çıkıyor. Kazanç da yok:
 * kartela zaten 10 KB.
 *
 * Karakter dokusu BÖYLE DEĞİL: 1024px'lik gerçek bir yüzey haritası, geniş
 * düz renk alanlarından oluşuyor ama küçültmeye dayanıyor. Onda bayrak
 * kullanılmıyor, doku normal yoldan 512px WebP'ye iniyor.
 *
 * Bayrak SADECE boyutu ilgilendiriyor. Dokuyu GLB'den ayırma işi ondan
 * bağımsız ve koşulsuz (sebebi aşağıda, birleştirme bloğunda).
 *
 * Önce "kayıpsız WebP'ye çevirelim" denedim: 10.5 KB PNG, 19.9 KB WebP oldu.
 * Düz renkli, geniş tek renk alanlı bir görselde PNG zaten en iyi biçim —
 * WebP'nin kazandığı yer fotoğrafik doku, burası değil.
 */
const PALETTE = argv.includes('--palette');
/**
 * --anims a,b,c : sadece bu animasyonları tut, gerisini at.
 *
 * Karakter paketlerinde ağırlık geometride değil ANİMASYONDA oluyor:
 * Kenney Blocky Characters'ın modeli 72 üçgen ama dosya 110 KB, çünkü
 * içinde 27 animasyon var (oturma, tekerlekli sandalye, emote...). Bir
 * runner'da 3-4 tanesi kullanılıyor; gerisini taşımak bedava değil.
 */
const ANIMS = argS('--anims', null);
/** --merge <ad>: bütün modelleri tek bir <ad>.glb dosyasında birleştirir. */
const MERGE = argS('--merge', null);
/** --only <ad>: sadece adı eşleşen dosyayı işle. */
const ONLY = argv.indexOf('--only') >= 0 ? argv[argv.indexOf('--only') + 1] : null;

/** Playable'da inline decoder maliyeti — three.js'in dağıttığı dosyalardan ölçüldü. */
const DRACO_DECODER_B64 = 448600;

const SEP = '\\';
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const b64len = (n) => Math.ceil(n / 3) * 4;
const pct5 = (n) => ((b64len(n) / (5 * 1024 * 1024)) * 100).toFixed(2) + '%';

await MeshoptSimplifier.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

function stats(doc) {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      tris += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0;
    }
  }
  const textures = doc.getRoot().listTextures();
  let texBytes = 0;
  let biggest = 0;
  for (const t of textures) {
    const img = t.getImage();
    if (img) texBytes += img.byteLength;
    const size = t.getSize();
    if (size) biggest = Math.max(biggest, size[0], size[1]);
  }
  return { tris: Math.round(tris), texCount: textures.length, texBytes, biggest };
}

async function size(doc) {
  return (await io.writeBinary(doc)).length;
}

async function run(file) {
  const name = basename(file, extname(file));
  const src = join(IN, file);
  const raw = statSync(src).size;

  const before = await io.read(src);
  const s0 = stats(before);

  console.log('\n  ' + '='.repeat(72));
  console.log('  ' + name);
  console.log('  ' + '='.repeat(72));
  console.log('  geldiği hâli : ' + kb(raw) + '   ' + s0.tris.toLocaleString() + ' üçgen   ' +
    s0.texCount + ' texture (' + kb(s0.texBytes) + ', en büyük ' + s0.biggest + 'px)');
  console.log('  base64 inline: ' + kb(b64len(raw)) + '  = 5MB bütçenin ' + pct5(raw) + '\n');

  const steps = [];

  // 1) temizlik
  const doc = await io.read(src);

  // Kullanılmayan animasyonları AT. Bu adım geometriden çok daha fazla
  // kazandırıyor: karakter paketlerinde dosyanın neredeyse tamamı keyframe.
  if (ANIMS) {
    const keep = ANIMS.split(',').map((x) => x.trim());
    const all = doc.getRoot().listAnimations();
    let dropped = 0;
    for (const a of all) {
      if (keep.indexOf(a.getName()) < 0) {
        a.dispose();
        dropped++;
      }
    }
    console.log('  animasyon: ' + all.length + ' -> ' + (all.length - dropped) + '  (' + keep.join(', ') + ')');
  }

  await doc.transform(dedup(), prune(), weld());
  steps.push(['temizlik (dedup+prune+weld)', await size(doc)]);

  // 2) mesh sadeleştirme — hedef üçgen bütçesine göre oran
  const cur = stats(doc);
  if (cur.tris > TRI_BUDGET) {
    const ratio = Math.max(0.01, TRI_BUDGET / cur.tris);
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }));
    steps.push(['+ simplify -> ~' + TRI_BUDGET + ' üçgen', await size(doc)]);
  } else {
    steps.push(['+ simplify (gerekmedi, zaten ' + cur.tris + ' üçgen)', await size(doc)]);
  }

  // 2.5) PBR haritalarını ayıkla. 20 saniyelik bir reklamda normal/AO/metallic
  // haritaları neredeyse hiç okunmuyor; baseColor + emissive yeterli. Bu,
  // texture'ın toplam boyutu domine ettiği yerde en büyük tek kaldıraç.
  if (BASECOLOR) {
    let dropped = 0;
    for (const mat of doc.getRoot().listMaterials()) {
      if (mat.getNormalTexture()) { mat.setNormalTexture(null); dropped++; }
      if (mat.getOcclusionTexture()) { mat.setOcclusionTexture(null); dropped++; }
      if (mat.getMetallicRoughnessTexture()) { mat.setMetallicRoughnessTexture(null); dropped++; }
      if (mat.getEmissiveTexture()) { mat.setEmissiveTexture(null); dropped++; }
      // Haritalar gidince sabit değerler mat bir yüzey vermeli
      mat.setRoughnessFactor(0.85);
      mat.setMetallicFactor(0.0);
    }
    await doc.transform(prune());
    steps.push(['+ PBR ayıkla (' + dropped + ' harita atıldı)', await size(doc)]);
  }

  // 3) texture: küçült + WebP (EXT_texture_webp, decoder GEREKTİRMEZ)
  //
  // KARTELA İSTİSNASI: --palette açıkken doku KÜÇÜLTÜLMÜYOR. Renk kartelasında
  // her renk minik bir kare; küçültmek komşu kareleri birbirine karıştırıyor ve
  // modeller ekranda griye dönüyor. Biçim yine WebP (10.5 KB PNG -> 2.1 KB),
  // ama çözünürlük olduğu gibi kalıyor.
  if (stats(doc).texCount) {
    await doc.transform(
      textureCompress(
        PALETTE
          ? { encoder: sharp, targetFormat: 'webp', quality: 80 }
          : { encoder: sharp, targetFormat: 'webp', resize: [TEX_SIZE, TEX_SIZE], quality: 80 }
      )
    );
    steps.push([PALETTE ? '+ texture WebP (kartela, kucultulmedi)' : '+ texture ' + TEX_SIZE + 'px WebP q80', await size(doc)]);
  }

  // 4) quantization — KHR_mesh_quantization, decoder GEREKTİRMEZ
  await doc.transform(quantize({ pattern: /.*/ }));
  const finalBytes = await size(doc);
  steps.push(['+ quantize (KHR_mesh_quantization)', finalBytes]);

  console.log('  ADIM                                    boyut      base64     bütçe');
  console.log('  ' + '-'.repeat(72));
  let prev = raw;
  for (const [label, bytes] of steps) {
    const delta = ((bytes - prev) / prev) * 100;
    console.log(
      '  ' + label.padEnd(38) +
      kb(bytes).padStart(10) +
      kb(b64len(bytes)).padStart(11) +
      pct5(bytes).padStart(9) +
      (delta < -0.5 ? '   ' + delta.toFixed(0) + '%' : '')
    );
    prev = bytes;
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name + '.opt.glb'), Buffer.from(await io.writeBinary(doc)));

  // 5) Draco karşılaştırması — decoder maliyetiyle birlikte
  const dracoDoc = await io.read(join(OUT, name + '.opt.glb'));
  await dracoDoc.transform(draco({ method: 'edgebreaker' }));
  const dracoBytes = await size(dracoDoc);
  const dracoTotal = b64len(dracoBytes) + DRACO_DECODER_B64;
  const plainTotal = b64len(finalBytes);

  console.log('\n  Draco karşılaştırması (aynı optimize model üzerinde):');
  console.log('    decoder\'sız        : ' + kb(plainTotal).padStart(10) + '  (inline base64)');
  console.log('    Draco + decoder    : ' + kb(dracoTotal).padStart(10) +
    '   (' + kb(b64len(dracoBytes)) + ' model + ' + kb(DRACO_DECODER_B64) + ' decoder)');
  console.log('    -> ' + (dracoTotal < plainTotal
    ? 'Draco kârda: ' + kb(plainTotal - dracoTotal)
    : 'Draco ZARARDA: ' + kb(dracoTotal - plainTotal) + ' fazla'));

  const st = stats(doc);
  console.log('\n  sonuç: ' + kb(raw) + ' -> ' + kb(finalBytes) +
    '  (' + (((finalBytes - raw) / raw) * 100).toFixed(1) + '%)   ' +
    st.tris.toLocaleString() + ' üçgen, ' + kb(st.texBytes) + ' texture');

  return { name, raw, out: finalBytes, tris: st.tris };
}

if (!existsSync(IN)) {
  console.error('Girdi klasörü yok: ' + IN);
  process.exit(1);
}
let files = readdirSync(IN).filter((f) => /\.(glb|gltf)$/i.test(f));
if (ONLY) files = files.filter((f) => f.toLowerCase().includes(ONLY.toLowerCase()));
if (!files.length) {
  console.error('assets-lab/in-3d içinde .glb yok.');
  process.exit(1);
}

const results = [];
for (const f of files) results.push(await run(f));

console.log('\n\n  ' + '='.repeat(72));
console.log('  ÖZET — hedef: ' + TRI_BUDGET + ' üçgen, ' + TEX_SIZE + 'px WebP texture');
console.log('  ' + '='.repeat(72));
console.log('  MODEL              geldiği      çıkan     base64   5MB bütçe   kazanç');
for (const r of results) {
  console.log(
    '  ' + r.name.padEnd(18) +
    kb(r.raw).padStart(10) +
    kb(r.out).padStart(11) +
    kb(b64len(r.out)).padStart(10) +
    pct5(r.out).padStart(10) +
    (((r.out - r.raw) / r.raw) * 100).toFixed(1).padStart(9) + '%'
  );
}
console.log('\n  Cikti klasoru: ' + OUT + '\n');

// ---------------------------------------------------------------- birleştirme
//
// PLAYABLE İÇİN DOĞRU ÇIKTI TEK GLB.
//
// Yedi araç ayrı ayrı optimize edilince yedi ayrı dosya oluyor ve her biri
// kendi JSON başlığını, kendi buffer'ını ve KENDİ TEXTURE KOPYASINI taşıyor.
// Oysa Kenney'nin araç setinde 50 modelin hepsi TEK bir 512px palet dokusunu
// paylaşıyor: modeller vertex renkli değil, UV'leri bir renk atlasına bakıyor.
//
// Hepsini tek dokümana alıp `dedup` çalıştırmak o kopyaları teke indiriyor.
// Playable'da zaten tek bir base64 bloğu gömülecek; dosya sayısı değil toplam
// bayt önemli.
if (MERGE) {
  const merged = new Document();
  for (const f of files) {
    const name = basename(f, extname(f));
    const doc = await io.read(join(OUT, name + '.opt.glb'));
    // Her modelin sahnesi tek bir isimli node altında toplanıyor: playable
    // tarafında nodes['sedan'] diye aranacak.
    const holder = doc.createNode(name);
    const scene = doc.getRoot().listScenes()[0];
    for (const child of scene.listChildren()) holder.addChild(child);
    scene.addChild(holder);
    mergeDocuments(merged, doc);
  }
  // merge sonrası birden çok sahne oluşuyor; hepsi tek sahnede toplanmalı.
  const scenes = merged.getRoot().listScenes();
  const main = scenes[0];
  for (const s of scenes.slice(1)) {
    for (const child of s.listChildren()) main.addChild(child);
    s.dispose();
  }
  merged.getRoot().setDefaultScene(main);
  // merge her dokumanin buffer'ini ayri getiriyor; GLB tek buffer istiyor.
  await merged.transform(dedup(), prune(), unpartition());

  // --- DOKUYU GLB'DEN ÇIKAR
  //
  // Reklam kutusunun güvenlik kuralı (CSP) GLB içine gömülü dokunun
  // yüklenmesini ENGELLİYOR: GLTFLoader gömülü görseli okumak için geçici bir
  // blob adresi üretip ağ isteği yapıyor, `connect-src` onu reddediyor ve
  // model dokusuz — yani renksiz — kalıyor. Artifact'te de, gerçek ağda da.
  //
  // Çözüm: dokuyu GLB'den al, yanında ayrı bir dosya olarak taşı. Playable
  // onu 2D atlasla aynı yoldan (data URI + <img>) yüklüyor; o yol kutuda
  // çalışıyor, çünkü ağ isteği değil.
  //
  // Bu adım KOŞULSUZ. Önce `--palette` bayrağına bağlıydı ama bu yanlıştı:
  // ayırma sebebini SANAT değil, TESLİMAT ortamı doğuruyor. Gömülü doku
  // hangi tarzda olursa olsun kutuda yüklenmiyor. `--palette` artık sadece
  // "dokuyu küçültme" anlamına geliyor.
  {
    const texs = merged.getRoot().listTextures();
    if (texs.length > 1) {
      console.log('  UYARI: ' + texs.length + ' doku var; ayirma yolu tek doku varsayiyor.');
    }
    if (texs.length === 1) {
      const t = texs[0];
      const ext = (t.getMimeType() || 'image/png').split('/')[1];
      const file = join(OUT, 'palette.' + ext);
      writeFileSync(file, Buffer.from(t.getImage()));
      // Dokuyu ÇALIŞMA ANINDA hangi malzemeye bağlayacağımızı işaretle.
      //
      // Runner sahnesinde iki tür malzeme yan yana: karakterin dokulu
      // malzemesi ve Nature Kit'in düz renkli ağaç/kaya malzemeleri. Paleti
      // ayrım yapmadan hepsine bağlayınca ağaçlar da karakter dokusunu
      // giyiyor. İşareti burada, dokuyu SÖKERKEN koymak tek doğru yer —
      // çalışma anında "bu malzemenin dokusu var mıydı" bilgisi kalmıyor.
      let marked = 0;
      for (const mat of merged.getRoot().listMaterials()) {
        if (!mat.getBaseColorTexture()) continue;
        mat.setBaseColorTexture(null);
        mat.setName('palette:' + (mat.getName() || 'mat'));
        marked++;
      }
      t.dispose();
      // prune() ÇAĞIRMA. Doku gidince UV'leri "kullanılmıyor" sayıp siliyor;
      // sonra paleti çalışma anında bağlayınca her yüzey uv=(0,0)'ı, yani
      // kartelanın sol üst köşesini okuyor — o köşe siyah, bütün modeller
      // simsiyah çıkıyor. Dokunun kendisi zaten dispose ile gitti.
      console.log('  doku ayrildi -> ' + file + '  (' +
        (statSync(file).size / 1024).toFixed(1) + ' KB, ' + marked + ' malzeme isaretlendi)');
    }
  }

  const outFile = join(OUT, MERGE + '.glb');
  await io.write(outFile, merged);
  const one = statSync(outFile).size;
  const many = results.reduce((a, r) => a + r.out, 0);
  const line = '  ' + '='.repeat(72);
  console.log('');
  console.log(line);
  console.log('  BİRLEŞTİRME — ' + files.length + ' model tek GLB icinde');
  console.log(line);
  console.log('  ayri ayri  : ' + kb(many).padStart(10) + '   base64 ' + kb(b64len(many)));
  console.log('  tek dosya  : ' + kb(one).padStart(10) + '   base64 ' + kb(b64len(one)) +
    '   -> ' + (one < many ? kb(many - one) + ' kazanc' : kb(one - many) + ' kayip'));
  console.log('  5 MB butcesinin ' + pct5(one) + ', Meta 2 MB limitinin ' +
    ((b64len(one) / (2 * 1024 * 1024)) * 100).toFixed(2) + '%');
  console.log('  -> ' + outFile);
  console.log('');
}
