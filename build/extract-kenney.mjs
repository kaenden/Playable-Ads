/**
 * Müşteri asset devrinin BİRİNCİ adımı: ayıklama ve isimlendirme.
 *
 *   node build/extract-kenney.mjs
 *
 * Kaynak: Kenney "Tower Defense (top-down)" paketi, CC0 (ticari kullanım
 * serbest, atıf zorunlu değil). assets-lab/vendor/kenney_td.zip
 *
 * Paket 299 sprite içeriyor ve HEPSİNİN adı `towerDefense_tile147.png`
 * biçiminde — yani hiçbir şey. Gerçek işte gelen klasör de çoğu zaman böyle
 * oluyor: dosya adları üreticinin dışa aktarım sırasına göre, oyunun
 * kavramlarına göre değil. Bu yüzden ilk iş sprite'ları GÖZLE tarayıp
 * kontakt sayfası çıkarmak, işe yarayanı seçmek ve anlamlı adla kopyalamak.
 *
 * Buradaki tablo o taramanın çıktısı. 299 sprite'tan 35'i kullanılıyor;
 * gerisi başka terrain kombinasyonları (kum, taş, su) ve bu reklamda
 * görünmeyecek varyantlar. Paketin tamamını atlasa koymak 5 MB bütçesinden
 * boşuna yer yerdi — asset optimizasyonunun ilk ve en büyük kazancı,
 * SEÇMEMEK'ten geliyor.
 *
 * İki boyut birden çıkarılıyor (64 px "Default" ve 128 px "Retina"), çünkü
 * hangisinin doğru olduğu ölçülecek bir soru: telefonda karo ~65 CSS px'e
 * düşüyor ama DPR 3'te bu 195 fiziksel piksel demek.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ZIP = join(ROOT, 'assets-lab', 'vendor', 'kenney_td.zip');

/** anlamlı ad -> paketteki karo numarası */
const PICK = {
  // --- zemin (opak, döşeniyor)
  grass: 24,
  dirt: 60,

  // --- kule yuvaları
  //
  // Bu seçim İKİ KEZ değişti ve ikisi de ekranda görüldükten sonra:
  //   38 (yeşil yuva) -> çimin üstünde yeşil kare, kaybolup gitti.
  //   15 (açık yuva)  -> paketin 15-18 karoları OPAK DEĞİL; zeminin üstüne
  //                      konan yarı saydam işaretçiler. Çimin üstünde hayalet
  //                      gibi durdular.
  //   84 (taş yuva)   -> opak, gri-mavi. Çimden hem renk hem malzeme olarak
  //                      ayrılıyor; "buraya kurulur" bilgisi yazısız geliyor.
  // Ders: kontakt sayfasında sprite'ın ŞEFFAFLIĞI görünmüyor, sadece şekli.
  slot: 84,
  slotIcon: 85,

  // --- kuleler (üç kademe)
  tower1: 249, // yeşil kaide, tek namlu
  tower2: 250, // kırmızı kaide, çift namlu
  tower3: 205, // füze rampası

  // --- düşmanlar
  foe1: 245, // yeşil piyade
  foe2: 247, // turuncu piyade
  foe3: 246, // kırmızı piyade
  tank: 291, // yeşil tank
  tankBig: 292, // kum rengi tank

  // --- mermiler
  bullet: 272,
  shell: 274,
  missile: 251,

  // --- patlama / namlu ateşi
  flame1: 295,
  flame2: 296,
  flame3: 298,

  // --- dekor (şeffaf zeminli)
  bush: 130,
  bushS: 131,
  plant: 132,
  tree: 133,
  palm: 134,
  rock1: 135,
  rock2: 136,

  // --- HUD rakamları: paketin KENDİ font sprite'ları.
  // Sistem fontu yerine bunları kullanmak reklamı "web sayfası" değil
  // "oyun" gibi gösteriyor; müşterinin UI kiti geldiğinde de yol aynı.
  d0: 276,
  d1: 277,
  d2: 278,
  d3: 279,
  d4: 280,
  d5: 281,
  d6: 282,
  d7: 283,
  d8: 284,
  d9: 285,
  dollar: 287,
  plus: 289,
};

const SIZES = {
  'in-2d-td': 'PNG/Retina/',
  'in-2d-td-64': 'PNG/Default size/',
};

if (!existsSync(ZIP)) {
  console.error('Kaynak paket yok: ' + ZIP);
  console.error('İndir: https://kenney.nl/assets/tower-defense-top-down  (CC0)');
  process.exit(1);
}

/** Node'da zip açmak için harici bağımlılık istemiyoruz; PowerShell yeterli. */
const TMP = join(ROOT, 'assets-lab', 'vendor', '.unzip');
if (!existsSync(join(TMP, 'PNG'))) {
  mkdirSync(TMP, { recursive: true });
  const q = (s) => "'" + s.replace(/'/g, "''") + "'";
  execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -Path ${q(ZIP)} -DestinationPath ${q(TMP)} -Force`],
    { stdio: 'ignore' }
  );
}

let total = 0;
for (const [outName, sub] of Object.entries(SIZES)) {
  const out = join(ROOT, 'assets-lab', outName);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  let bytes = 0;
  for (const [name, tile] of Object.entries(PICK)) {
    const src = join(TMP, sub, 'towerDefense_tile' + String(tile).padStart(3, '0') + '.png');
    if (!existsSync(src)) {
      console.error('Eksik karo: ' + src);
      process.exit(1);
    }
    const buf = readFileSync(src);
    writeFileSync(join(out, name + '.png'), buf);
    bytes += buf.length;
  }
  total += bytes;
  console.log(
    '  ' + outName.padEnd(14) + Object.keys(PICK).length + ' sprite  ' + (bytes / 1024).toFixed(1) + ' KB ham PNG'
  );
}

// Lisans metni çıktının yanında dursun: portfolyoda kaynak belirsiz kalmamalı.
const lic = join(TMP, 'License.txt');
if (existsSync(lic)) {
  writeFileSync(join(ROOT, 'assets-lab', 'in-2d-td', 'LICENSE-kenney.txt'), readFileSync(lic));
}

console.log('\n  299 sprite içinden ' + Object.keys(PICK).length + ' tanesi seçildi.');
console.log('  Sonraki: npm run assets:td\n');
void total;
