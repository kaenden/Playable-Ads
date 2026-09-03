# Asset Optimizasyon Hattı — 2D ve 3D

**Tarih:** 2 Eylül 2026
**Çalıştır:** `npm run assets:2d` · `npm run assets:3d`
Girdi `assets-lab/in-2d/` ve `assets-lab/in-3d/`, çıktı `out-2d/` ve `out-3d/`.

Bu, işin merkezindeki beceri: müşteri kaynak asset gönderiyor, biz onu playable'a
sığan ve açılabilen bir formata çeviriyoruz ([02-WORKFLOW-AND-ASSETS.md](02-WORKFLOW-AND-ASSETS.md) §1).
Her sayı ölçülmüş, tahmin yok.

---

## Playable'ı normal web'den ayıran iki kural

**1. Ölçü ham dosya değil, base64 hâli.** Her şey tek HTML'e inline oluyor, +%33.
Raporların hepsi base64 boyutunu ve 5 MB bütçesindeki payını gösteriyor.

**2. Kazanan en küçük değil, decoder gerektirmeyen en küçük.** Playable network
isteği yapamıyor; bir decoder gerekiyorsa o da inline olmak zorunda. Draco 448 KB,
KTX2 761 KB tutuyor — ikisi de kazandırdıklarından fazla ([03](03-3D-ASSET-EXPERIMENT.md)).

---

## 2D hattı

`build/assets-2d.mjs` — trim → atlas paketleme → format yarışı → kalite ölçümü.

### Test girdisi
5 karakter sprite'ı, 512×512 RGBA PNG, toplam **1215.9 KB**.

### Adım 1 — trim
Şeffaf kenarları atmak bedava kazanç. Sprite'ların ikisinde piksel alanı **%35**
düştü, üçünde (gölge/hâle kenara kadar taştığı için) %1.

### Adım 2 — atlas
İkili ağaç paketleyici: 1415×1025, doluluk %77.

### Adım 3 — format yarışı

| Format | Boyut | base64 | 5MB bütçe | PSNR | Decoder |
|--------|-------|--------|-----------|------|---------|
| PNG kayıpsız | 805.5 KB | 1074.0 KB | %20.98 | kayıpsız | yerleşik |
| PNG-8 (256 renk) | 138.7 KB | 184.9 KB | %3.61 | 37.3 dB | yerleşik |
| WebP kayıpsız | 569.3 KB | 759.0 KB | %14.82 | kayıpsız | yerleşik |
| WebP q90 | 258.0 KB | 343.9 KB | %6.72 | 39.4 dB | yerleşik |
| **WebP q80** | **175.9 KB** | **234.6 KB** | **%4.58** | **38.0 dB** | yerleşik |
| WebP q70 | 137.2 KB | 182.9 KB | %3.57 | 36.8 dB | yerleşik |
| AVIF q60 | 106.7 KB | 142.3 KB | %2.78 | 42.9 dB | yerleşik* |
| AVIF q45 | 63.4 KB | 84.5 KB | %1.65 | 39.4 dB | yerleşik* |

**Sonuç: 1215.9 KB → 175.9 KB (−%85.5).**

### Neden WebP q80, AVIF q45 değil

AVIF metrikte açık ara kazanıyor: q60, WebP q90'dan **daha kaliteli** (42.9 vs
39.4 dB) ve **%59 daha küçük**. Ama playable eski bir ad-container webview'ında
açılmazsa kreatif **boş ekran** olur. Kazandığı 112 KB, 5 MB bütçenin %2'si —
o risk 2 puana değmez.

**Kural:** AVIF ancak hedef envanterin webview sürümünü doğrulayabiliyorsan.
Tek dosya playable'da iki formatı birden gömmek de anlamsız, çünkü kazancı yiyor.

### Atlas mı, ayrı dosyalar mı — cevap "duruma göre"

| | Boyut | base64 |
|---|---|---|
| 5 ayrı dosya (WebP q80) | 173.8 KB | 231.7 KB |
| Tek atlas (WebP q80) | 175.9 KB | 234.6 KB |

Bu sette **ayrı dosyalar 2 KB daha küçük**: 5 büyük sprite var ve atlasın %23'ü
boş kalıyor. Atlas çok sayıda küçük sprite'ta kazanıyor; bir avuç büyük sprite'ta
paketleme israfı sıkıştırma kazancını yiyor. "Atlas her zaman daha iyi" doğru değil.

---

## 3D hattı

`build/assets-3d.mjs` — temizlik → simplify → texture → quantize.
Decoder gerektiren hiçbir adım yok:

| Kaldıraç | Ne yapıyor | Decoder |
|----------|-----------|---------|
| `weld` + `dedup` + `prune` | tekrarlı vertex/veri temizliği | — |
| `simplify` (meshoptimizer) | üçgen sayısını hedefe indirir | — |
| `EXT_texture_webp` | texture'ı WebP yapar | tarayıcı natively açar |
| `KHR_mesh_quantization` | vertex float32 → int16/int8 | three.js'te **yerleşik** |

### Sonuçlar — Khronos örnek modelleri, hedef 4.000 üçgen / 512px texture

| Model | Geldiği | Çıkan | base64 | 5MB bütçe | Kazanç |
|-------|---------|-------|--------|-----------|--------|
| Avocado | 7920.0 KB | **33.7 KB** | 44.9 KB | %0.88 | −%99.6 |
| BoomBox | 10365.4 KB | **134.4 KB** | 179.2 KB | %3.50 | −%98.7 |
| DamagedHelmet | 3685.5 KB | **479.8 KB** | 639.7 KB | %12.49 | −%87.0 |
| Duck | 117.7 KB | **74.9 KB** | 99.9 KB | %1.95 | −%36.3 |

BoomBox tek başına 10.6 MB geliyordu — playable bütçesinin **iki katı**. Çıkarken
134 KB, yani bütçenin %3.5'i.

### Hangi adım ne kadar kazandırıyor (DamagedHelmet)

| Adım | Boyut | Değişim |
|------|-------|---------|
| geldiği hâli | 3685.5 KB | — |
| temizlik | 3679.0 KB | ~0 |
| + simplify → 4.000 üçgen | 3589.9 KB | −%2 |
| **+ texture 512px WebP q80** | **574.1 KB** | **−%84** |
| + quantize | 479.8 KB | −%16 |

**Texture ezici çoğunluk.** 15 bin üçgeni 4 bine indirmek %2 kazandırıyor, texture'ı
2048'den 512'ye çekip WebP yapmak %84. Geometri optimizasyonuyla uğraşmadan önce
texture'a bak.

### `--basecolor`: gereksiz PBR haritalarını at

20 saniyelik bir reklamda normal/AO/metallicRoughness/emissive haritaları
neredeyse okunmuyor. `node build/assets-3d.mjs --basecolor`:

| Model | Varsayılan | `--basecolor` | Fark |
|-------|-----------|---------------|------|
| Avocado | 33.7 KB | **21.9 KB** | −%35 |
| BoomBox | 134.4 KB | **87.7 KB** | −%35 |
| DamagedHelmet | 479.8 KB | **399.7 KB** | −%17 |
| Duck | 74.9 KB | 74.9 KB | zaten tek harita |

DamagedHelmet'te kazanç düşük çünkü haritalar zaten 512 WebP'ye inmişti; orada
kalan yük **geometri**. simplify 4.000 hedefine inemiyor, 12.378 üçgende
duruyor — meshoptimizer UV dikişlerini koruduğu için oran her modelde
tutturulamıyor. Bu bir sınır, hata değil; ama "ratio verdim, indi" varsayımı yanlış.

### Draco her modelde zararda

Aynı optimize modeller üzerinde ölçüldü, decoder maliyeti dahil:

| Model | Decoder'sız | Draco + decoder | Fark |
|-------|-------------|-----------------|------|
| Duck | 99.9 KB | 478.7 KB | **+378.8 KB zarar** |
| BoomBox | 179.2 KB | 544.8 KB | **+365.6 KB zarar** |
| DamagedHelmet | 639.7 KB | 719.2 KB | **+79.4 KB zarar** |

[03-3D-ASSET-EXPERIMENT.md](03-3D-ASSET-EXPERIMENT.md)'teki sonucu bağımsız
modellerde doğruluyor.

---

## Asset hattı bayt dışında da kayıplı

GLB yolu ilk çalıştığında modeller yüklendi ama **kanatlar kayıptı** — her
yaratıkta iki yerine bir kanat.

İlk hipotezim simplify'dı: 2 üçgenlik kanat düzlemlerini siliyor olabilirdi.
Ölçtüm — simplify sadece 2.2 KB kazandırıyordu (61.8 vs 64.0 KB) ve kapatınca
kanat gelmedi. Yani hem yanlış hipotezdi hem de bu asset için simplify zaten
kötü bir takas.

İkinci hipotez negatif ölçekti: kanatlar `scale.x = -1` ile aynalanıyor.
Aynalamayı geometriye taşıdım — **asset tarafı düzelmedi, üstüne çalışan
prosedürel tarafı da bozdum**, çünkü `rotation.y = dir * 0.5` aynalanmış
çerçevede ters yöne dönüyor.

Gerçek sebep sarım yönüydü: three'nin renderer'ı prosedürel sahnede negatif
determinantı görüp cull yönünü çeviriyor, ama glTF'e yazılan modelde bu bilgi
kalmıyor ve ters sarımlı yüzler backface-cull'a takılıp **görünmez oluyor**.
Çözüm tek satır: yükleme sırasında malzemeleri `DoubleSide`'a çekmek.

Ders: **asset hattı geometriyi de bozabiliyor, sadece küçültmüyor.** Ve
"optimize ettim, boyut düştü" demek yetmiyor — çıktıyı ekranda görmek gerekiyor.

---

## Araç yazarken düşülen iki tuzak

**1. `sharp`ta `png({ effort })` sessizce palet moduna geçiriyor.** "Kayıpsız PNG"
satırım aslında kuantize PNG-8'di; ikisi birebir aynı PSNR veriyordu ve bunu ancak
"iki farklı encoder nasıl aynı ondalığı verir" diye sorunca fark ettim. Gerçek
kayıpsız için yalnızca `compressionLevel`.

**2. PSNR alfa ağırlıklı olmalı.** İlk sürüm ham RGBA'yı doğrudan karşılaştırıyordu
ve kayıpsız kodlamaya bile 13.8 dB diyordu: tamamen şeffaf piksellerin RGB'si
encoder'a göre değişiyor, atlasın da %23'ü boş, dolayısıyla görünmeyen pikseller
hatayı domine ediyordu. Görünmeyen pikselin rengi kalite değildir.

Her iki hata da aynı türden: **ölçüm aracının kendisi doğrulanmadan sonuçlarına
güvenilmez.** Aynı ders `perf.ts`'te de çıkmıştı (README dersi 14).

---

## Hat gerçekten playable'a bağlı

`art.ts` artık iki kaynağı da destekliyor, aynı `sprite(level, px)` arayüzünün
arkasında. `__ART__` derleme zamanı sabiti seçiyor, kullanılmayan dal minify'da
siliniyor:

```bash
node build/build.mjs --pl merge-2d --net showcase              # prosedürel
node build/build.mjs --pl merge-2d --net showcase --art atlas  # WebP atlas
```

Atlas bizim kendi sprite'larımızdan üretildiği için **iki build birebir aynı
pikselleri** gösteriyor. Yani fark tamamen art hattının maliyeti:

| Playable | Art kaynağı | Paket | 5MB bütçe |
|----------|-------------|-------|-----------|
| merge-2d | prosedürel canvas çizimi | **28.3 KB** | %0.55 |
| merge-2d-atlas | WebP atlas (inline) | **263.5 KB** | %5.15 |
| merge-3d | prosedürel primitif | **575.3 KB** | %11.24 |
| merge-3d-atlas | optimize GLB + GLTFLoader | **973.5 KB** | %19.01 |

**2D'de asset hattı 9.3 kat büyük**, aynı görüntü için. Raster art'ın bedeli
sadece bayt değil: 235 KB base64'ü çözmek ilk kareyi ~20 ms'den ~70 ms'ye çıkarıyor.

**3D'de fark 1.7 kat** (+398 KB) — ama bu farkın DÖKÜMÜ önemli ve bir süre
yanlış okundu: 398 KB'ın 234.6'sı HUD'un 2D atlası, 82.4'ü modelin kendisi,
**sadece 80 KB'ı GLTFLoader**. Aşağıdaki *"DÜZELTME"* bölümü bunu ayrıntısıyla
anlatıyor; kısası şu: yükleyicinin sabit bedeli kaçınılacak kadar büyük değil.

> Bu tablodaki karşılaştırma, prosedürel üretilebilen KENDİ sanatımız için
> geçerli. Gerçek işte müşteri asset gönderiyor ve seçenek yok; o zaman soru
> "prosedürel mi asset mi" değil, **"gelen asset'i ne kadar küçültebiliyorum"**
> oluyor. Projedeki asıl teslimler bu yüzden asset build'leri.

### 3D asset yolu nasıl kuruldu

Yaratık geometrisi `creatures.ts`'te tek kaynak; hem tarayıcıda çalışıyor hem
Node'da. `build/export-creatures.mjs` onu esbuild ile bundle'layıp GLTFExporter
ile GLB'ye çeviriyor — böylece prosedürel ve asset sürümleri **aynı geometriden**
çıkıyor ve karşılaştırma adil oluyor.

```
creatures.ts --(export)--> creatures.glb 325.4 KB
             --(assets:3d)--> creatures.opt.glb 64.0 KB  (-%80.3)
             --(build --art atlas)--> bundle'a base64 gömülü
```

Model KHR_mesh_quantization ile sıkıştırılmış; GLTFLoader bunu yerleşik
destekliyor. Draco'yu elemiş olmamızın somut karşılığı: **ek decoder yok.**

Bu, "prosedürel mi asset mi" tartışmasının ölçülmüş hâli. Gerçek müşteri işinde
seçenek yok — onların art'ı gelir ve atlas yolu kullanılır; bu hat o yolu
çalışır hâlde tutuyor. Prosedürel taraf ise asset gelmediğinde de üretebilmek
ve bütçe kritik olduğunda başvurulacak kart olarak duruyor.

> Uyarı: bu karşılaştırma bizim sprite'larımız üzerinden. Gerçek IP art'ı
> prosedürel olarak üretilemez; oradaki tek seçenek atlas ve o zaman soru
> "hangisi" değil, "atlası ne kadar küçültebiliyorum" olur.

---

## DÜZELTME: yükleyicinin bedeli 400 KB değil, 80 KB

Bu doküman bir süre şunu yazdı: *"`GLTFLoader` bir şey yüklemeden önce ~400 KB
giriş bedeli istiyor, o yüzden birkaç modelde asset yolu pahalı."* **Yanlıştı**,
ve üçüncü playable'ın sanat yönünü yanlış tarafa çevirdi.

Sayı iki build'in farkından alınmıştı:

```
merge-3d prosedürel   580.5 KB
merge-3d asset        978.7 KB   ->  fark 398.2 KB   "demek ki yükleyici bu kadar"
```

Ama `merge-3d-atlas` build'i sadece modeli değil, HUD'un 2D sprite atlasını da
gömüyor. Farkı bileşenlerine ayırınca:

| Bileşen | Boyut |
|---|---|
| 2D WebP atlas (base64) | 234.6 KB |
| creatures GLB (base64) | 82.4 KB |
| **GLTFLoader + tutkal** | **80.0 KB** |
| toplam | 397.0 KB |

398.2 ile 397.0 arasındaki 1.2 KB de kapanıyor. Ölçüm, 2D atlası hiç
kullanmayan bir birimde tekrarlanınca doğrulandı:

```
escape-3d prosedürel  583.1 KB
escape-3d asset       945.9 KB   ->  fark 362.8 KB
                                       eksi GLB base64 282.8 KB
                                       = yükleyici 80.0 KB
```

**Ders:** iki build'in farkı, aralarındaki TEK farkın maliyeti değildir.
Değişkeni izole etmeden çıkarılan sayı, ölçüm değil tahmindir.

### Sonuç ne değişti

80 KB, 5 MB bütçede kaçınılacak bir giriş bedeli değil, yuvarlama hatası.
Yani doğru soru "model yükleyelim mi" değil, **"kaç model sığar"**:

| | sabit kod | modele kalan (GLB) | ~model |
|---|---|---|---|
| 5 MB (çoğu ağ) | 644 KB | 3357 KB | **~110** |
| 2 MB (Meta index) | 644 KB | 1053 KB | **~34** |

Sabit kod = Three.js 514 + GLTFLoader 80 + oyun ~50 KB. Model başına 30 KB,
aşağıdaki araç setinden ölçüldü.

Müşteriyle konuşulacak cümle bu: *"otuz küstür optimize model gönderin,
Meta'nın index limiti bile alır."*

---

## Müşteri modelleriyle 3D: `escape-3d` asset yolu

Üçüncü playable artık iki türlü derleniyor ve **asset olan asıl teslim**:

| | paket | 5 MB'ın |
|---|---|---|
| `escape-3d` (prosedürel — yedek) | 583.1 KB | %11.39 |
| **`escape-3d-atlas` (müşteri modelleri)** | **945.9 KB** | **%18.47** |

Kaynak: **Kenney "Car Kit", CC0.** Paketin tamamı 50 model / 5.5 MB — tek
başına bütçeyi aşıyor, yani seçim yine ilk iş.

### Devrin gerçeği: gelen GLB kendi kendine yetmiyordu

Hat ilk koşuda çöktü:

```
Error: ENOENT ... assets-lab/in-3d-cars/Textures/colormap.png
```

Modeller texture'ı **dışarıdan** referans ediyor. Klasörden sadece `.glb`'leri
almak yetmedi; `Textures/` de gelmek zorundaydı. Teslim tarihi vermeden önce
kontrol edilecek şey.

### Ölçü nerede: geometride, texture'da değil

`colormap.png` **12.1 KB, 512×512** ve **50 modelin hepsi onu paylaşıyor**.
Modeller vertex renkli değil; UV'leri bir renk atlasına bakıyor. Yani araç
başına 190 KB'ın neredeyse tamamı geometri — texture sıkıştırmak buradaki
sorunu çözmezdi.

### Hat

| Adım | Sonuç |
|---|---|
| geldiği hâli (7 model) | **1271.4 KB** |
| dedup + prune + weld | −%60 (kaynaştırılmamış tekrar vertex'ler) |
| texture 256px WebP | −%15 |
| quantize (KHR_mesh_quantization) | −%30 |
| ayrı ayrı optimize toplamı | 299.0 KB |
| **tek GLB'de birleştirme** | **212.1 KB** |

Birleştirme tek başına **86.9 KB** kazandırıyor: yedi ayrı dosya yedi JSON
başlığı, yedi buffer ve yedi texture kopyası taşıyordu. `--merge` adımı
`mergeDocuments` + `dedup` + `unpartition` ile hepsini teke indiriyor.

**1271.4 KB -> 212.1 KB, -%83.3.** base64 hâli 282.8 KB = 5 MB'ın %5.52'si.

### Hizalama, asset devrinin standart bedeli

- **Yön:** Kenney araçlarının uzunluk ekseni Z'de, simülasyon +X bekliyor.
  Modelleri yeniden dışa aktarmak yerine yükleme anında bir kez döndürülüyor.
- **Ölçek:** modeller kendi birimlerinde (2.55–3.10 uzun, 1.30–1.50 geniş),
  oyunun hücresi 1 birim. Sabit bir çarpan yanlış olurdu; her model kendi
  ölçüsüne göre hücreye oturtuluyor.

### Prosedürel taraf ne oldu

Silinmedi, **yedek oldu**. GLB parse edilemezse `modelFor()` null dönüyor ve
sahne kendi kutularını üretmeye devam ediyor — oyun oynanabilir, CTA canlı.
WebGL yedeğiyle aynı mantık: asset yolunun her adımının bir düşüş hattı var.

Yan çıktı olarak kalan `roundedBox()` — `Shape` + `ExtrudeGeometry` ile bevel'lı
kutu; three'nin çekirdeğinde `RoundedBoxGeometry` yok, 20 satırla yerine
geçiyor.

**Ölçüm nereye dokunmalı, oraya dokundu:** ilk kare 340 ms çıkınca şüpheli
geometri üretimi sanıldı; suçlu asfalt dokusundaki gren döngüsüydü (hücre
başına 220 nokta, 5500 `fillRect`). 45'e indirilince **137 ms**, görüntüde
fark yok.

---

## Hattın gerçek işi: üçüncü taraf paketiyle çalışmak (`defense-2d`)

İlk üç birim sanatını kendi çiziyordu. Dördüncüsü işin gerçek hâlini yapıyor:
başkasının sprite klasörü geliyor ve 5 MB'a sığan bir kreatife dönüşüyor.

Kaynak: **Kenney "Tower Defense (top-down)", CC0** — 299 sprite, hepsinin adı
`towerDefense_tile147.png`. Yani hiçbir şey. Gerçek müşteri klasörü de çoğu
zaman böyle: dosya adları dışa aktarım sırasına göre, oyunun kavramlarına göre
değil.

### Adımlar

| # | Adım | Sonuç |
|---|------|-------|
| 1 | Kontakt sayfası çıkar, 299 karoyu gözle tara | `build/extract-kenney.mjs` içindeki eşleme tablosu |
| 2 | Gerekeni seç, anlamlı adla kopyala | **299 → 37** sprite, 133.6 KB ham PNG |
| 3 | Trim + atlas + format yarışı | **23.3 KB**, 38.0 dB, 586×540 atlas |
| 4 | base64 gömme | 31.1 KB, 5 MB bütçesinin %0.61'i |

Bitmiş birim **87.0 KB** — oyun, sanat, ses, CTA, hepsi dahil.

### Buradan çıkan dört şey

**1) En büyük kazanç seçmemekten geliyor.** Trim+atlas+encode %83 indiriyor
ama asıl karar 299 yerine 37 sprite almak. Paketin tamamı 1 MB'ın üstünde bir
atlas demekti. En ucuz bayt, hiç girmeyen bayt.

**2) Kazanan format sanat tarzına bağlı.** Bizim gradyanlı sprite'larımızda
PNG-8 kaybediyordu; Kenney'nin düz vektör paletinde neredeyse kayıpsız
kuantize oluyor:

| Format | Boyut | PSNR |
|--------|-------|------|
| PNG kayıpsız | 45.4 KB | — |
| **PNG-8 (256 renk)** | **26.8 KB** | **50.2 dB** |
| WebP q90 | 30.6 KB | 39.1 dB |
| **WebP q80** ← seçilen | **23.3 KB** | **38.0 dB** |
| AVIF q45 | 17.3 KB | 39.7 dB |

Tek bir sprite'ı (kule yuvası karosu) değiştirmek kazananı PNG-8'den WebP'ye
çevirdi. "Hangi format en iyi" sorusunun evrensel cevabı yok; yarış her pakette
yeniden koşulmalı.

> Not: PNG-8, WebP'den 3.5 KB büyük ama 12 dB daha kaliteli. 5 MB bütçede
> 3.5 KB %0.07 — bu ölçekte kalite lehine bozmak savunulabilir. Aracın
> kuralı ("38 dB üstündekilerin en küçüğü") bayt kuralı; fark bütçede
> yuvarlama hatası kadarken kalitenin kazanması gerekir. Not düşüldü,
> araç şimdilik olduğu gibi bırakıldı.

**3) Retina sorusu kendi kendine cevaplanıyor.** Paket 64 ve 128 px veriyor:

| Kaynak | Atlas | base64 | 5 MB'ın |
|--------|-------|--------|---------|
| 64 px | 12.8 KB | 17.0 KB | %0.33 |
| **128 px** | **23.3 KB** | **31.1 KB** | **%0.61** |

İkiye katlamanın bedeli bütçenin %0.3'ü; karşılığı 3x ekranda bulanık olmayan
sanat. Tartışılacak bir şey yok.

**4) Atlas artık kazanıyor.** Merge'in 5 büyük sprite'ında ayrı dosyalar 2 KB
öndeydi. 37 küçük sprite'ta atlas 2.1 KB kazandırıyor. Eşik sprite SAYISINDA:
her dosyanın kendi başlığı ve sözlüğü var.

### Ekranda öğrenilen: kontakt sayfası şeffaflığı göstermiyor

Kule yuvası sprite'ı iki kez yanlış seçildi:

- **38** (yeşil yuva) — çimin üstünde yeşil kare, kayboldu.
- **15** (açık yuva) — paketin 15-18 karoları opak değil, zeminin üstüne
  konan **yarı saydam işaretçiler**. Çimin üstünde hayalet gibi durdular.
- **84** (taş yuva) — opak, gri-mavi, çimden hem renk hem malzeme olarak
  ayrılıyor. Doğru olan bu.

Üçü de kontakt sayfasında normal görünüyordu. Sprite seçimi masa başında
bitmiyor; oyunun içine koyup bakmak gerekiyor.

### Paketin sınırı düzeni belirliyor

Kenney'nin terrain karoları bir **bölge** seti: geniş organik alanların kenar
ve köşe parçaları (kendi Sample.png'sinde de öyle kullanılmış). Tek karo
genişliğinde kıvrılan bir yol için gereken 16 parçalık auto-tile seti pakette
yok. Bu yüzden yolun **silueti** kodla çiziliyor (yuvarlak uçlu kalın çizgi),
**içi paketin kendi toprak karosuyla** dolduruluyor.

Sanat yönü müşterinin, esneyen düzen. Gerçek işte de olan bu.

---

## Aynı sanat, iki boyut: `match-2d` / `match-3d`

Hattın en net ölçümü bu. Soru şu: **2D mi 3D mi diye sorarken aslında neyin
bedelini ödüyoruz?**

Dolaşımdaki karşılaştırmalar aynı anda iki şeyi değiştiriyor — renderer'ı ve
sanatı. Bu çift sanatı SABİT tutuyor:

- Taşlar **Kenney Food Kit**, CC0. 5 model, geldiği hâli 92.3 KB.
- 3D sürüm modelleri ızgaraya koyuyor.
- 2D sürüm **o modellerden render edilmiş** sprite'ları kullanıyor.

Sektörde de böyle: match-3'lerin 2D art'ının çoğu düz çizilmiş değil,
pre-render edilmiş 3D.

### Model -> sprite adımı

`build/render-sprites.mjs` tek dosyalık bir sayfa üretiyor; sayfa GLB'yi
parse edip her modeli 256px'e, 3D sürümle **aynı ışıkla** render ediyor.
Çıktı PNG olarak yazılıp 2D hattının girdisi oluyor.

Neden paketin kendi `Previews/` klasörünü kullanmadık: o PNG'ler **64px
thumbnail**. Asset seçerken iş görür, 3x ekranda bulanık.

İlk sürümde kadraj `max(x,y,z)`'den hesaplanıyordu ve muz kadrajın yarısında
kalıyordu — eğik bakışta uzun kenarın ekrandaki karşılığı kendisinden kısa.
Doğrusu köşeleri kamera uzayına taşıyıp gerçek izdüşümü ölçmek.

### İki hat, iki sonuç

| | girdi | çıktı | base64 | 5 MB'ın |
|---|---|---|---|---|
| 3D (GLB, 5 model) | 92.3 KB | **31.5 KB** | 42.0 KB | %0.82 |
| 2D (sprite, 5 adet) | 116.8 KB | **8.4 KB** | 11.2 KB | %0.22 |

2D atlası WebP q70'te 38.7 dB — trim %60 alan kazandırdığı için (render'lar
şeffaf kenarlı) sıkıştırma öncesi bile küçülmüş.

### Asıl sonuç

| Bileşen | 2D | 3D |
|---|---|---|
| Sanat | 11.2 KB | 42.0 KB |
| Oyun + HUD + ses + ad yaşam döngüsü | 32.8 KB | 32.8 KB |
| Three.js + GLTFLoader | — | **608 KB** |
| **Paket** | **43.3 KB** | **682.8 KB** |

**3D'yi seçmek bir sanat kararı değil, 608 KB'lık bir karar.** Sanat tarafı
31 KB oynuyor; 5 MB bütçede bu gürültü. Alınan şey renderer.

Karşılığı da gerçek: derinlik, dönüş, ışık. Taşın hacmini ancak dönerken
görüyorsun ve sprite bunu taklit edemiyor. Kendini 3D'liğiyle satan bir oyun
için değer; ikon ızgarası için savunması zor.

> Ölçümün kontrollü olduğunun kontrolü: iki birim tek `state.ts`, tek
> `layout.ts`, tek `hud.ts` ve tek animasyon dosyası paylaşıyor. Betikle
> oynanan aynı senaryo ikisinde de birebir aynı sonucu veriyor.

---

## Renk kartelası: hattın en pahalı yanlış varsayımı

Kenney'nin 3D kitlerinde modeller **renkli değil**. Hepsi tek bir küçük
görseli paylaşıyor: içi minik renk kareleriyle dolu bir **kartela**. Her
yüzeyin UV'si o karelerden birine bakıyor. Onlarca model 10 KB'lık tek
dosyayla renkleniyor — paketin en zekice tarafı bu.

Hat bunu normal doku sandı ve iki yerde birden bozdu:

| Nerede | Ne yapıyordu | Sonuç |
|---|---|---|
| Hat | Dokuyu küçültüyordu (512 -> 256, hatta 128) | Renk kareleri yarıya indi, kenarları birbirine değdi |
| Çalışma anı | Mipmap + linear filtre | Nesne küçüldükçe kartelanın ORTALAMASI okundu |

Ortalamanın rengi gri. Yani **nesne büyükken renkli, küçülünce griye
dönüyordu.** Ekranda "bazı araçların rengi var, bazılarının yok" gibi
görünüyordu; aslında hepsi aynıydı, sadece ekrandaki boyları farklıydı.

### Çözüm iki tarafta birden

- **Hatta `--palette`:** doku küçültülmüyor. Biçim yine WebP (10.5 KB PNG ->
  2.1 KB) ama çözünürlük olduğu gibi kalıyor. Bedeli araç setinde 1.1 KB.
- **Yüklemede `core/palette.ts`:** en yakın komşu örnekleme, mipmap kapalı.
  Kartelada tek doğru okuma biçimi bu.

### Yol boyunca iki yanlış deneme

**"Kayıpsız WebP yapalım"** — 10.5 KB PNG, 19.9 KB WebP oldu. Düz renkli,
geniş tek renk alanlı bir görselde PNG zaten en iyi biçim; WebP'nin
kazandığı yer fotoğrafik doku.

**"Kullanılmayan animasyonları atalım"** — Kenney Blocky Characters'ta 27
animasyon var, bir runner'da 4'ü lazım. Gereksizleri atınca dosya
**47.4'ten 64.5 KB'a çıktı**: paket animasyon verisini ortak erişimcilerle
paylaşıyor ve budama o paylaşımı bozuyor (104 erişimci -> 278). Paketin
kendi paketlemesi benim optimizasyonumdan iyiydi.

> Ortak ders: **paket zaten optimize edilmiş olabilir.** Her adımı ölçmeden
> uygulamak, iyileştirme değil bozma riski taşıyor.

---

## Gömülü doku reklam kutusunda yüklenmiyor

Kartela düzeltmesinden sonra modeller HÂLÂ renksizdi. Sebep filtre değil,
**güvenlik kuralıydı** — ve bunu ancak tarayıcı konsolu söyledi:

```
Fetch API cannot load blob:... Refused to connect because it violates
the document's Content Security Policy.
THREE.GLTFLoader: Couldn't load texture blob:...
```

GLTFLoader, GLB'nin içine gömülü görseli okumak için geçici bir **blob
adresi** üretip `fetch` yapıyor. Reklam kutusunun `connect-src` kuralı bu
isteği reddediyor, doku hiç yüklenmiyor, model dokusuz kalıyor.

**Bu artifact'e özgü bir tuhaflık değil.** Ağ container'ları da aynı şekilde
kısıtlıyor; hata sahaya çıksaydı orada da patlayacaktı.

### Çözüm: dokuyu GLB'nin yanında taşı

Hat, birleştirmenin sonunda tek base-color dokusunu GLB'den söküp
`palette.webp` olarak yanına yazıyor. Oyun onu **2D atlasla aynı yoldan**
yüklüyor: `<img>` + data URI. Bu yol ağ isteği değil ve kutuda çalışıyor.

Bu adım artık **koşulsuz**. İlk sürümde `--palette` bayrağına bağlıydı ve
yanlıştı: ayırma sebebini SANAT değil **teslimat ortamı** doğuruyor. Doku
kartela da olsa yüzey haritası da olsa gömülü hâlde yüklenmiyor. `--palette`
artık yalnızca "dokuyu küçültme" anlamına geliyor.

### Sökerken çıkan üç tuzak

| Belirti | Sebep | Çözüm |
|---|---|---|
| Her şey **simsiyah** | Doku gidince `prune()` UV'leri "kullanılmıyor" sayıp sildi; her yüzey uv=(0,0)'ı, kartelanın siyah köşesini okudu | O noktada `prune()` çağırma |
| Hâlâ **simsiyah** | Elle kurulan doku varsayılan olarak kenara kırpıyor; bu kitlerin UV'leri 0-1 dışına taşıyor | `RepeatWrapping` |
| Ağaçlar **karakter dokusu giydi** | Doku ayrım yapmadan bütün malzemelere bağlandı | Hat, söktüğü malzemenin adına `palette:` öneki koyuyor; çalışma anı sadece işaretlileri boyuyor |

Üçüncüsü runner'a kadar ortaya çıkmadı, çünkü ondan önceki her sahnede tek
tür malzeme vardı. Runner'da karakterin dokulu malzemesi ile Nature Kit'in
düz renkli ağaç/kaya malzemeleri yan yana duruyor.

---

## Animasyonlu karakter: `run-3d`

İlk kez rig/animasyon taşıyan bir paket geldi. Kenney Blocky Characters'ın
karakteri **kemiksiz** çalışıyor: iskelet yok, animasyon yedi düğümü
(gövde, iki kol, iki bacak, kafa, kök) oynatıyor ve her parça katı bir kutu.

Bu, üretim tarafında bilinmesi gereken bir ayrım. Kemikli (skinned) modelde
deformasyon vertex seviyesinde olur; kemiksiz modelde her parça sadece bir
4x4 matris. Reklam ölçeğinde ikincisi hem daha küçük hem çok daha ucuz.

### Quantize animasyonu bozmuyor

Endişe: `quantize` vertex verisini int16'ya indirirken ölçek/kaydırmayı
**düğüm dönüşümüne** koyuyor — ve bu projede animasyonun yazdığı düğümler
tam olarak mesh taşıyan düğümler. Çakışma beklenirdi.

gltf-transform bunu doğru çözüyor: dönüşümü taşımak için **yeni isimsiz alt
düğümler** açıyor, isimli (animasyonlu) düğümlere dokunmuyor. Ölçtük, klipler
27'si de sağlam çıkıyor.

### Ölçüler

| | |
|---|---|
| Kaynak | 15 model (1 karakter + 14 doğa parçası), 224.0 KB |
| Hattan çıkan | **105.5 KB** tek GLB + 5.2 KB doku |
| Klip sayısı | 27 (hepsi taşınıyor — budamak dosyayı büyütüyor) |
| Paket | 796.5 KB, 5 MB'ın %15.6'sı |

### Çizim çağrısı da bir bütçe

Sahne 337 çizim çağrısıyla açılıyordu ve bu mobilde tek başına kare süresini
yer. İki müdahale, ikisi de asset'in yapısından çıkıyor:

1. **Kalabalık instancing.** Karakterin parçaları katı olduğu için her VÜCUT
   PARÇASI tek bir `InstancedMesh` olabiliyor: bütün sol bacaklar tek çağrı.
   Kalabalık 5 kişi de olsa 30 kişi de olsa **6 çağrı**. Kemikli bir modelde
   bu mümkün değildi.
2. **Statik birleştirme.** Koridorun kenarındaki ~55 ağaç/kaya/çit hiç
   kımıldamıyor. Açılışta aynı malzemeyi paylaşan bütün yüzeyler dünya
   koordinatına pişirilip tek mesh'te toplanıyor.

**337 -> 89**, üstelik ekranda daha kalabalık bir sahneyle.

### Malzeme dünyaları karışabiliyor

Aynı sahnede iki farklı malzeme türü vardı ve ikisi de ayrı ilgi istedi:

- **Karakter UNLIT** geliyor (`KHR_materials_unlit`). Işık almıyor, ekranda
  hep aynı parlaklıkta. Kalabalık için istenen şey: 20 kişi üst üste binince
  gölge karmaşası olmuyor, siluet net kalıyor.
- **Doğa parçaları PBR** ve pakette `metalness = 1` yazıyor. Ortam haritası
  olmayan bir sahnede bu ağaçları **simsiyah** yapıyor — metalik yüzeyin
  rengi yansımadan gelir, yansıtacak bir şey yoksa siyahtır. Yüklemede hepsi
  Lambert'e çevriliyor: hem doğru görünüyor hem PBR shader'ının maliyeti
  gidiyor. 20 saniyelik bir reklamda kimse metalik yansıma aramıyor.

---

## Sıradaki

- [ ] PBR haritalarını ayıklama modu (`--basecolor`) — DamagedHelmet'i bir daha katlar
- [ ] Spine runtime denemesi (ilanlarda sık geçiyor)
- [ ] KEMİKLİ (skinned) karakter denemesi — bu paket kemiksiz geldi, skinning
      maliyeti ve InstancedMesh'in orada NEDEN işe yaramadığı hâlâ ölçülmedi
- [ ] Ses: prosedürel yerine gerçek SFX geldiğinde Opus/AAC karşılaştırması
