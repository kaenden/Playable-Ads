# Playable Ads Lab

Playable ad portfolyosu + tek dosya build pipeline'ı.
**Altı birim, dört mekanik:** merge (aynı çekirdek, iki renderer), izometrik
3D trafik bulmacası, gerçek zamanlı kule savunma ve match-3 (yine iki
renderer). Her birim tek bir HTML dosyası, sıfır dış istek.

**Asıl teslim asset build'i.** Gerçek işte sanat müşteriden geliyor; hattın
merkezi de o. Her birim ayrıca prosedürel derleniyor ama o YEDEK: asset
gelmediğinde ya da ağın limiti yer bırakmadığında başvurulan yol.

- Araştırma ve pazar notları: [00-RESEARCH.md](00-RESEARCH.md)
- Üretim akışı, asset devri, 2D/3D pipeline: [02-WORKFLOW-AND-ASSETS.md](02-WORKFLOW-AND-ASSETS.md)
- 3D asset deneyi (Draco / KTX2 ölçümü): [03-3D-ASSET-EXPERIMENT.md](03-3D-ASSET-EXPERIMENT.md)
- **Asset optimizasyon hattı (2D + 3D):** [04-ASSET-PIPELINE.md](04-ASSET-PIPELINE.md)
- Sahadan kayıtlar ve teardown'lar: [Sample Ads/](Sample%20Ads/)
- **Vitrin (paylaşılabilir link):** https://claude.ai/code/artifact/34f3200b-b2d9-458c-ae74-11ec0793eaf0

---

## Kullanım

```bash
npm install
npm run dev                        # merge-2d, localhost:8080, watch
npm run dev:3d                     # merge-3d
npm run dev:escape                 # escape-3d (izometrik trafik bulmacası)
npm run dev:td                     # defense-2d (kule savunma, müşteri asset'i)
npm run dev:m2                     # match-2d   (match-3, sprite)
npm run dev:m3                     # match-3d   (aynı oyun, model)
npm run build                      # 6 playable x 10 hedef = 60 paket (prosedürel yedek)
node build/build.mjs --pl merge-3d --net unity    # tek kombinasyon
npm run probe:3d                   # GLB + Draco ölçüm deneyini tekrarla
npm run assets:2d                  # PNG'leri trim+atlas+format yarışı ile optimize et
npm run assets:td                  # Kenney 2D paketini ayıkla + optimize et (defense-2d)
npm run assets:cars                # Kenney Car Kit'i optimize edip tek GLB'de birleştir
npm run assets:food                # Kenney Food Kit -> tek GLB (match-3d'nin taşları)
node build/render-sprites.mjs      # o modellerden 2D sprite üret (tek seferlik sanat adımı)
npm run build:assets               # dört birimi de ASSET yoluyla derle
npm run assets:3d                  # GLB'leri simplify+WebP+quantize ile optimize et
node build/build.mjs --pl merge-2d --net showcase --art atlas   # atlas'lı varyant
npm run preflight                  # platform uyumluluk denetimi (90 paket)
npm run showcase                   # build + vitrin sayfasını üret
node build/serve.mjs               # dist/ klasörünü LAN'a aç (telefon testi)
npx tsc --noEmit                   # typecheck
```

Telefonda test: `npm run dev`, sonra telefondan `http://<LAN-IP>:8080`.

---

## Çıktı

| | merge-2d | merge-3d | escape-3d | defense-2d |
|---|---|---|---|---|
| Mekanik | merge | merge | tıka-aç bulmaca | **kule savunma (gerçek zamanlı)** |
| Renderer | canvas 2D | Three.js, perspektif | Three.js, ortografik izometrik | canvas 2D |
| Fail-hook | hamle | süre | süre | **can** |
| **asset build** | **263.6 KB** | **975.1 KB** | **945.9 KB** | **87.0 KB** |
| 5 MB bütçesi | %5.15 | %19.05 | %18.47 | %1.70 |
| Meta 2 MB index limiti | %12.9 | %47.6 | %46.2 | %4.25 |
| prosedürel yedek | 28.3 KB | 579.7 KB | 583.1 KB | — |
| WebGL yoksa | – | 2D'ye düşüyor | 2D'ye düşüyor | – |

Asset kaynakları (hepsi CC0, ticari kullanım serbest):

| birim | kaynak | geldiği hâl | hattan çıkan |
|---|---|---|---|
| merge-2d / merge-3d | kendi sprite'larımız + `creatures.glb` | 1215.9 KB | 175.9 KB atlas + 61.8 KB GLB |
| escape-3d | Kenney **Car Kit** (7 model) | 1271.4 KB | **212.1 KB** tek GLB |
| defense-2d | Kenney **Tower Defense** (37 sprite) | 133.6 KB | **23.3 KB** atlas |
| match-2d / match-3d | Kenney **Food Kit** (5 model) | 92.3 KB | 11.2 KB sprite / 30.2 KB GLB |
| run-3d | Kenney **Blocky Characters** + **Nature Kit** (15 model) | 224.0 KB | **105.5 KB** tek GLB + 5.2 KB doku |

Sekiz ağ için ayrı paketleniyor (+ preview ve vitrin hedefleri = 10),
prosedürel yedeği olanlar iki sanat yoluyla: **100 paket.**

### Beşinci birim: `run-3d` (Crowd Rush)

İlk animasyonlu karakterli birim ve ilk "tahta" yerine SAHNE kuran birim.
Karakter Kenney Blocky Characters, koridor Kenney Nature Kit; ikisi de CC0,
15 model tek GLB'de.

| | değer |
|---|---|
| Mekanik | koşu + tek parmak yön verme |
| Fail-hook | **kalabalık sayısı** — hata da bedel de aynı birimde |
| Ödül anı | ~21 saniye |
| Paket | **796.5 KB** (5 MB'ın %15.6'sı) |
| Çizim çağrısı | **81** (ilk hâli 337) |
| Kalabalık | 6 çağrı, kaç kişi olursa olsun |
| WebGL yoksa | 2D'ye düşüyor |

Karakterin animasyonu PARÇALI (kemiksiz): paket yedi düğüm oynatıyor ve her
parça katı bir kutu. Bunun iki getirisi var — animasyon üç kez hesaplanıp
kalabalığa kopyalanabiliyor, ve her VÜCUT PARÇASI tek bir InstancedMesh
olabiliyor (bütün sol bacaklar tek çizim çağrısı). Koridorun kenarındaki
statik süs de malzemeye göre birleştiriliyor.

### Aynı oyun iki kere: `match-2d` / `match-3d`

Bulduğum bütün "2D mi 3D mi" karşılaştırması aynı anda İKİ şeyi değiştiriyor:
renderer'ı ve sanatı. Bu çift sanatı sabit tutuyor. Taşlar Kenney Food Kit
modelleri; 3D sürüm modelleri ızgaraya koyuyor, 2D sürüm ise **o modellerden
render edilmiş** sprite'ları kullanıyor (match-3'lerin çoğunun 2D art'ı
zaten pre-render edilmiş 3D'dir).

İki birim tek `state.ts`, tek `layout.ts`, tek `hud.ts` ve tek animasyon
eğrisi dosyası paylaşıyor. Betikle oynanan aynı senaryo ikisinde de birebir
aynı sonucu veriyor (`h10t0 h9t7`, kazanma, 7 toplanan, 9 hamle kalan) —
karşılaştırmanın gerçekten kontrollü olduğunun kontrolü bu.

| Bileşen | 2D | 3D |
|---|---|---|
| Sanat (atlas / GLB) | 11.2 KB | 42.0 KB |
| Oyun + HUD + ses + ad yaşam döngüsü | 32.8 KB | 32.8 KB |
| Three.js + GLTFLoader | — | **608 KB** |
| **Paket** | **43.3 KB** | **682.8 KB** |
| 5 MB bütçesinin | %0.84 | %13.34 |

**3D'yi seçmek bir sanat kararı değil, 608 KB'lık bir karar.** Sanat tarafı
5 MB bütçede 31 KB oynuyor — gürültü. Alınan şey renderer, karşılığında
verdiği şey derinlik, dönüş ve ışık. Kendini 3D'liğiyle satan bir oyun için
değer; ikon ızgarası için savunması zor.

### Bütçede ne kadar yer var

Sabit kod: Three.js 514 + GLTFLoader **80** + oyun ~50 = **644 KB**.

| | modele kalan (GLB) | ~model |
|---|---|---|
| 5 MB (çoğu ağ) | 3357 KB | **~110** |
| 2 MB (Meta index) | 1053 KB | **~34** |

Model başına 30 KB, Car Kit ölçümünden. Müşteriye söylenecek cümle bu.

---

## Mimari

```
src/
  index.html               ortak şablon (her iki playable, her ağ)
  globals.d.ts             derleme zamanı sabitleri
  core/                    ← RENDERER'DAN BAĞIMSIZ, İKİSİ DE KULLANIYOR
    config.ts              UA ekibinin A/B test edeceği tüm sayılar
    state.ts               saf oyun mantığı — DOM yok, canvas yok, three yok
    layout.ts              ekran geometrisi, hit-test, buton dikdörtgenleri
    hud.ts                 header, timer, tutorial, butonlar, end card (2D ctx)
    fx.ts                  partikül / halka / sarsıntı (2D ctx)
    input.ts               pointer + touch, eski webview fallback'i
    art.ts                 prosedürel 2D sprite (HUD ikonları + 2D playable)
    ad.ts                  ağ başına CTA + MRAID yaşam döngüsü
  core/draw.ts               roundRect / outlinedText / fitFont — sprite üreticisinden ayrı
  playables/
    merge-2d/  main.ts + view2d.ts       canvas 2D tile render
    merge-3d/  main.ts + view3d.ts       Three.js sahne + mesh üretimi
    escape-3d/ kendi state / layout / hud / input +
               view3d.ts   ortografik izometrik sahne
               view2d.ts   WebGL'siz container için yedek
               props.ts    prosedürel araç, ada, ağaç, asfalt dokusu
    defense-2d/ kendi state / layout / hud / input +
               atlas.ts    paketin rakam sprite'larıyla sayı yazma
               view2d.ts   statik katman (çim+yol+dekor) + canlı katman
    match/     TEK KLASÖR, İKİ BİRİM — ortak state/layout/hud/input/anim +
               view2d.ts + main2d.ts   sprite ile
               view3d.ts + main3d.ts   model ile (WebGL yoksa 2D'ye düşüyor)
  core/atlas.ts              genel sprite atlası (defense-2d'den çıkarıldı)
build/
  networks.mjs             ağ başına head script'i, paket tipi, boyut limiti
  build.mjs                esbuild -> inline -> bütçe raporu -> zip
```

**İddia test edildi:** 3D sürüme geçerken `state.ts` tek satır değişmedi.
`layout.ts`, `hud.ts`, `fx.ts`, `input.ts`, `ad.ts` de aynen kullanıldı.
Değişen tek şey `view2d.ts` → `view3d.ts`.

**Üçüncü birim çekirdeği paylaşmıyor — bilerek.** Merge'in `state`/`layout`/`hud`
dosyaları merge'e ait; farklı bir mekaniği oraya sığdırmak ikisini birden
bozardı. Paylaşılan şey gerçekten oyundan bağımsız olan kısım: `ad.ts`,
`audio.ts`, `perf.ts`, `fx.ts`, `draw.ts`. Bu ayrımı yaparken `fx.ts`'in
merge'in renk tablosunu okuduğu, `perf.ts`'in merge'in `Layout` tipine bağlı
olduğu ortaya çıktı; ikisi de gerçek bağımlılık değildi ve söküldü.

### 3D'yi 2D layout'una oturtan numara

`View3D` bir **PerspectiveCamera**'yı z=0 düzlemi **piksel birebir** olacak şekilde
kuruyor: görünür yükseklik = ekran yüksekliği, kamera mesafesi
`h / 2 / tan(fov/2)`. Böylece `Layout`'un hesapladığı ekran dikdörtgenleri 3D
dünyada da geçerli oluyor — hit-test, CTA konumu ve tutorial ipucu 2D sürümle
birebir aynı kodu kullanmaya devam ediyor. z>0'daki objeler kameraya yaklaştığı
için gerçek perspektif korunuyor, ortografik "yassı 3D" görüntüsü oluşmuyor.

HUD ayrı bir şeffaf 2D canvas'ta, WebGL canvas'ının üstünde duruyor. Input da ona
bağlı. Gerçek playable'larda da UI 3D sahnenin içinde değil üstünde.

### Eğik sahnede aynı problem: ortografik kamera

`escape-3d`'de sahne ekrana paralel değil, 3/4 açıyla eğik. Merge'deki
"perspektif kamerayı piksel birebir kur" numarası burada işlemiyor: eğik bir
kutuyu verilen bir ekran dikdörtgenine perspektifle tam oturtmak yinelemeli
arama gerektiriyor.

**OrthographicCamera** ile aynı iş kapalı formda çözülüyor. Ortografik izdüşüm
doğrusal olduğu için dünya birimi → piksel oranı sahnenin her yerinde aynı;
sahnenin sınır kutusunun 8 köşesi kamera uzayına taşınıp `left/right/top/bottom`
doğrudan hesaplanıyor:

```
s     = min((board.w - 2m) / bw, (board.h - 2m) / bh)   // px / dünya birimi
left  = minX - tx / s          top    = maxY + ty / s
right = left + ekran.w / s     bottom = top - ekran.h / s
```

Yan faydası: izometrik görünüm zaten istenen oyuncak estetiği.

**Girdi ışınla toplanıyor.** Eğik sahnede aracın çatısı ayak izinden görünür
biçimde kaymış duruyor; zemine ışın atıp hücre hesaplamak, oyuncunun gördüğü
araçtan başkasını seçerdi. `Raycaster` doğrudan araç mesh'lerine bakıyor,
bulunan mesh'ten yukarı doğru grup aranıp araç kimliği çıkarılıyor.

**Sarsıntı kamerada değil dünyada.** Kamerayı oynatmak `fitCamera`'nın kurduğu
piksel eşlemesini bozuyor ve dokunma hedefleri kayıyor; sahne grubunu kaydırmak
izdüşümü bozmuyor.

---

## Ağ başına ne değişiyor

`__AD_NETWORK__` esbuild `define` ile gömülüyor, kullanılmayan CTA dalları
minify'da siliniyor. Doğrulandı:

```
unity -> mraid      facebook -> FbPlayableAd      google -> ExitApi      tiktok -> openAppStore
```

| Ağ | CTA | Head | Paket |
|----|-----|------|-------|
| Meta | `FbPlayableAd.onCTAClick()` | – | tek .html |
| Google App campaigns | `ExitApi.exit()` | `exitapi.js` (Google CDN) | ZIP + `ad.size` meta |
| TikTok / Pangle | `window.openAppStore()` | `playable-sdk.js` | ZIP + `config.json` |
| Unity, AppLovin, ironSource, Mintegral, Moloco | `mraid.open(url)` | `mraid.js` | .html / ZIP |

---

## Elle yaparken çıkan dersler

1. **Phaser hiç seçenek değildi.** Mevcut oyunlarımızdaki phaser chunk'ı tek
   başına 1.5 MB. Sıfır framework + prosedürel sprite ile 2D playable 20 KB.

2. **Three.js ölçüldü: 569 KB.** Tree-shaken, minified, tek dosyaya inline.
   Phaser'ın üçte biri. 5 MB bütçenin %11'i, Meta'nın 2 MB index limitinin %28'i —
   yani 3D playable tek başına sorun değil, sorun **asset**. Bütçenin geri kalanı
   modele ve texture'a gidecek.

3. **Dead-code eliminasyonu sabite doğrudan bağlı.** `const NETWORK = __AD_NETWORK__`
   yazınca esbuild sabiti katlayamadı ve her pakete dört ağın CTA kodu birden girdi.
   Karşılaştırma `__AD_NETWORK__ === 'facebook'` şeklinde doğrudan yapılınca temizlendi.

4. **`</script>` kaçırılmalı.** Bundle inline edilirken içindeki `</script>`
   dizisi HTML parser'ı erken kapatıyor.

5. **`setPointerCapture` atabiliyor.** Sentetik event'lerde ve eski webview'larda
   exception fırlatıp listener'ı yarıda kesiyor. try/catch şart.

6. **Landscape'i test etmeden bitti sanma.** "DRAG TO MERGE" etiketi landscape'te
   + EGG butonunun üstüne biniyordu.

7. **Tutorial en yakın çifti göstermeli**, ilk bulduğu çifti değil.

8. **Rastgelelik playable'da düşman.** Açılış dizilimi deterministik: tam 4 merge.

9. **Prosedürel art'ta silüet her şey.** Boynuzlar ince bezier sliver'ıyken anten
   gibi okunuyordu; ejderhanın ayrı elips burnu onu domuza çeviriyordu.

10. **Dokunma göstergesi altındaki taşı kapatmamalı.** Dolu daire → halka + iç nokta.

11. **3D'de parametre sırası sessizce hata veriyor.** `eyes(g, r, z, y)` imzasını
    `(y, z)` sanıp çağırınca 3. seviyenin gözleri kürenin İÇİNDE kaldı — hata yok,
    uyarı yok, sadece gözsüz bir yaratık. Aynı şekilde kanatlar z=-0.35r'de gövdenin
    arkasında kayboluyordu. **3D'de her mesh'i ekranda görmeden "yaptım" deme.**

12. **3D efektleri 3D olmak zorunda değil.** Partikül ve halkalar WebGL sahnesinde
    değil, üstteki HUD canvas'ında 2D olarak çiziliyor. Aynı `fx.ts` iki playable'da
    da çalışıyor; 3D partikül sistemi bundle'ı ve GPU'yu boşuna yorardı.

13. **Draco ve KTX2 playable'da ZARARDA — ölçüldü.** Web'in standart 3D reçetesi
    burada tersine dönüyor, çünkü playable network isteği yapamıyor: decoder'ın
    kendisi de inline olmak zorunda. Draco decoder 448 KB (base64), KTX2 transcoder
    761 KB. Ölçtüğümüz en iyi Draco kazancı 15k üçgenlik modelde 416 KB — yani
    **en iyi senaryoda bile 32 KB net zarar.** Başabaş ~390 KB ham GLB geometrisi,
    ki oraya ulaşan asset zaten bütçeyi patlatıyor.
    Kazanan: mesh'i küçültmek (lowpoly GLB 56 KB) ve texture'da **WebP**
    (PNG'nin 9–12 katı küçük, decoder maliyeti sıfır).
    Tüm sayılar: [03-3D-ASSET-EXPERIMENT.md](03-3D-ASSET-EXPERIMENT.md)

14. **Aynı sayıyı veren ölçüm, dikkat çekici değil bozuktur.** İlk FPS/yükleme
    göstergem `firstFrameMs`'i modül yüklenirken alıyordu; init ve ilk render'ı
    hiç kapsamıyordu. 21 KB'lık 2D ile 570 KB'lık 3D build **ikisi de 99 ms**
    dedi. İki radikal farklı build'in aynı sayıyı vermesi bulgu değil, hataydı.
    Ölçüm gerçekten ilk frame'de alınınca fark ortaya çıktı: 49 ms vs 180 ms.

15. **Format kararlarını referans reklamlar veriyor, sezgi değil.** Üç canlı kreatifin
    teardown'ı (bkz. `Sample Ads/02-...`) üç değişikliğe yol açtı: geri sayım yerine
    **hamle bütçesi** (match-3 "4 hamlede kazanamazsın" diyordu), kutlamanın CTA'dan
    **ayrı bir sahne** olması (Toon Blast önce "Level Completed!", sonra logo kartı),
    ve **TRY AGAIN** ikinci butonu. Ayrıca "boşluğa dokun = install" kaldırıldı;
    referansların üçü de açık buton kullanıyor.

16. **Referansa bakarken kimin çizdiğine dikkat et.** İlk okumada "X kapatma butonu
    ekleyelim" diye not almıştım. Karelere yakından bakınca × creative'in içinde değil,
    dışında: container'ın çizdiği buton. Kendimiz koysak çift kapatma butonu olurdu.

17. **Asset hattı geometriyi de bozabiliyor.** GLB'den yüklenen yaratıklarda
    kanatlar kayıptı. İlk iki hipotezim (simplify, negatif ölçek) yanlış çıktı;
    ikincisini "düzeltirken" çalışan prosedürel tarafı bozdum. Gerçek sebep:
    three'nin renderer'ı negatif determinantı görüp cull yönünü çeviriyor, glTF'e
    yazılan modelde bu bilgi yok, ters sarımlı yüzler görünmez oluyor. Çözüm
    yüklemede `DoubleSide`. **Boyut düştü demek doğru çalışıyor demek değil.**

18. **Denetim aracının markerı, denetlediğin kütüphaneye ait olmamalı.** WebGL
    geri düşüşü var mı diye `webglcontextlost` arıyordum — three.js o listener'ı
    kendi içinde kaydediyor, dolayısıyla her 3D paket "geri düşüşü var" görünüyordu.
    Yanlış negatif. Marker artık sadece bizim koyduğumuz `WEBGL_FALLBACK`.

19. **Kaynakta URL geçmesi istek yapıldığı anlamına gelmiyor.** Preflight ilk
    sürümü düz regex'le tarayıp three.js içindeki XML namespace'ini
    (`www.w3.org/1999/xhtml`) ve bir yorumdaki akademik atfı red sebebi saydı;
    bütün 3D paketler "RED" çıktı. Artık yalnızca gerçekten yükleme yapan
    konumlara (`src=`, `href=`, `url(`, `fetch(`) bakılıyor.

20. **WebGL yoksa boş ekran gösterme.** Ad container'larının bir kısmı WebGL'siz
    çalışıyor; orada `new WebGLRenderer()` patlıyor ve reklam beyaz kalıyor —
    impression yanıyor, CTA hiç görünmüyor. 3D birim artık WebGL'i yoklayıp
    yoksa 2D renderer'a düşüyor. Bedeli 4.4 KB, karşılığı sıfırlanmış bir
    kreatif riski. Tarayıcıda `getContext('webgl')` kapatılarak doğrulandı.

21. **Sayaç, hatanın yaşadığı yeri ölçmeli.** Merge'de geri sayımı hamle
    bütçesiyle değiştirmiştik; üçüncü birimde geri sayıma DÖNDÜK, ve bu bir
    tutarsızlık değil kuralın kendisi. Merge'de yanlış bırakma bir karardır,
    o yüzden kararlar sayılır. Tıka-aç bulmacasında tıkalı bir araca dokunmak
    karar değil bilgi toplamadır — oyuncu hangi aracın kimi kilitlediğini
    böyle öğreniyor. Onu bütçeden düşmek, oyuncuya oyunu öğrenmeyi
    yasaklamak olurdu. Baskı saatten geliyor.

22. **Paylaşılan dosya, en ağır kullanıcısının boyutunu herkese ödetiyor.**
    `fx.ts` sadece partikül rengi için merge'in seviye tablosunu `art.ts`'ten
    okuyordu; `art.ts` ise 500 satırlık sprite üreticisi. Efekt sistemini
    kullanan her yeni playable o üreticiyi de bundle'ına alıyordu ve
    tree-shaking bunu kesemiyor, çünkü çağrı cache üzerinden gidiyor. Renk
    artık parametre; iki çizim yardımcısı `core/draw.ts`'e ayrıldı.

23. **Ölçmeden "yavaş" deme, ölçünce de tahmin etme.** Üçüncü birimin ilk
    karesi 340 ms çıktı. Şüpheli olan geometri üretimiydi; suçlu asfalt
    dokusundaki gren döngüsüydü — hücre başına 220 nokta, 5500 `fillRect`.
    45'e indirilince ilk kare **137 ms**. Görüntüde fark yok.

24. **Yedek renderer'ın sözleşmesi açık yazılmalı.** merge-3d'de `View3D` ile
    `View2D`'nin metodları tesadüfen uyuşuyordu ve `main.ts` `View3D | View2D`
    yazıyordu. escape-3d'de ortak arayüz (`view.ts`) tanımlı: eksik metotlu bir
    yedek renderer derlenmiyor.

25. **Kontakt sayfası şeffaflığı göstermiyor.** Kule yuvası sprite'ı iki kez
    yanlış seçildi ve ikisi de ancak ekranda anlaşıldı: yeşil yuva (38) çimin
    üstünde kayboldu, açık yuva (15) ise opak değil — paketin 15-18 karoları
    zeminin üstüne konan YARI SAYDAM işaretçiler. İkisi de kontakt sayfasında
    normal görünüyordu, çünkü orada sprite'ın şekli var şeffaflığı yok.
    Doğrusu taş yuva (84) oldu. Asset seçimi masa başında bitmiyor.

26. **Format yarışı pakete göre yeniden koşulmalı.** Bizim gradyanlı
    sprite'larımızda PNG-8 kaybediyordu; Kenney'nin düz vektör paletinde
    neredeyse kayıpsız kuantize oluyor ve WebP'nin 2.7 KB yakınına 12 dB
    üstün kaliteyle geliyor. Tek bir sprite'ı değiştirmek (yuva karosu)
    kazananı PNG-8'den WebP'ye çevirdi. "Hangi format en iyi" sorusunun
    evrensel cevabı yok, sanat tarzına bağlı.

27. **Eski çıktı dosyası bayat kalıyor.** Hat kazanan formatı yazıyor ama
    öncekini silmiyordu; build `atlas.png` -> `atlas.webp` sırasıyla arıyor ve
    bir önceki koşudan kalan PNG'yi bulup GÖMÜYORDU. Yeni atlas üretildiği
    hâlde pakette eskisi vardı. Çıktı klasörü artık her koşuda temizleniyor.

28. **Asset optimizasyonunun en büyük kazancı SEÇMEMEK.** 299 sprite'lık
    paketten 37'si kullanılıyor. Trim + atlas + encode üçlüsü 133.6 KB'ı
    23.3 KB'a indiriyor (-%83), ama paketin tamamını almak baştan 1 MB'ın
    üstünde bir atlas demekti. En ucuz bayt, hiç girmeyen bayt.

29. **Retina sorusu bütçe karşısında kendi kendine cevaplanıyor.** Paket
    64 ve 128 px veriyor; ikiye katlamanın bedeli 5 MB'ın %0.3'ü (~14 KB),
    karşılığı 3x ekranda bulanık olmayan sanat. Tartışılacak bir şey yok.

30. **`source-atop` clip değildir.** Yolun içini paketin toprak karosuyla
    doldururken önce çizgiyi arka plana çizip `source-atop` ile desen
    basıyordum; çim zaten tuvali opak kapladığı için desen HER YERE gitti ve
    ekran baştan aşağı toprak oldu. Path2D'nin `clip()`'i de çare değil —
    dolgu bölgesini alıyor, bizim yol ise kalın bir çizgi. Doğrusu: şeffaf
    bir katmana çizgiyi çizip `source-in` ile deseni içine hapsetmek.

31. **Ödül anı 30 saniyeyi geçmemeli.** İlk denge ayarında dalga 37. saniyede
    bitiyordu; izleyici kazanma anını hiç görmeden çıkardı. Hızlar %25
    artırılıp tarife sıkıştırıldı, kule atış aralığı aynı oranda düşürüldü —
    denge korundu, kazanma anı 21. saniyeye çekildi.

32. **İki build'in farkı, aralarındaki tek farkın maliyeti değildir.** Bu
    projede en pahalı ölçüm hatası buydu. "GLTFLoader ~400 KB" diye
    yazmıştım; sayı `merge-3d` (580.5) ile `merge-3d-atlas` (978.7) farkından
    geliyordu. Ama asset build'i sadece modeli değil HUD'un 2D atlasını da
    gömüyor. Döküm: 234.6 KB atlas + 82.4 KB GLB + **80.0 KB yükleyici** =
    397.0 (fark 398.2, kalan 1.2 KB tutkal). 2D atlas kullanmayan bir birimde
    tekrarlayınca doğrulandı. Değişkeni izole etmeden çıkarılan sayı ölçüm
    değil tahmindir — ve bu tahmin üçüncü playable'ın sanat yönünü yanlış
    tarafa çevirdi.

33. **Yükleyicinin bedeli kaçınma sebebi değil.** 80 KB, 5 MB bütçede
    yuvarlama hatası. Doğru soru "model yükleyelim mi" değil "kaç model
    sığar": sabit kod 644 KB, kalanı modele ayırınca **5 MB'a ~110**,
    Meta'nın 2 MB index limitine **~34** optimize model giriyor.

34. **Gelen GLB kendi kendine yetmeyebilir.** Kenney Car Kit'in `.glb`
    dosyaları texture'ı `Textures/colormap.png` diye DIŞARIDAN referans
    ediyor; sadece modelleri kopyalayınca hat ilk adımda ENOENT ile çöktü.
    Teslim tarihi vermeden önce paketin kendi kendine yeterli olup olmadığına
    bakılmalı.

35. **Bir sette ölçü hep aynı yerde değil.** Car Kit'te 50 modelin hepsi tek
    bir 12.1 KB'lık 512px palet dokusunu paylaşıyor — modeller vertex renkli
    değil, UV'leri renk atlasına bakıyor. Yani araç başına 190 KB'ın neredeyse
    tamamı geometri; texture sıkıştırmak buradaki sorunu çözmezdi. Hangi
    kaldıracın işe yarayacağı pakete bakılmadan bilinmiyor.

36. **Playable'da doğru çıktı tek GLB.** Yedi araç ayrı ayrı optimize edilince
    299.0 KB; hepsi tek dokümanda birleşip `dedup` + `unpartition` görünce
    **212.1 KB**. Aradaki 86.9 KB, yedi JSON başlığı, yedi buffer ve yedi
    texture kopyasıydı.

37. **Karşılaştırma yaparken bir şey değiştir.** "2D mi 3D mi" sorusunun
    dolaşımdaki cevapları hem renderer'ı hem sanatı değiştiriyor. `match-2d`
    ve `match-3d` sanatı sabit tutuyor: aynı modeller, biri sahnede, biri
    o modellerden render edilmiş sprite olarak. Sonuç 43.3'e 682.8 KB ve
    farkın 608 KB'ı renderer, 31 KB'ı sanat. Sanat sabitlenmeseydi bu cümle
    kurulamazdı.

38. **Paketin preview'ları üretim sanatı değil.** Food Kit her modelin
    PNG'sini veriyor ama 64px thumbnail — asset seçerken işe yarar, 3x
    ekranda bulanık. Modelden kendi sprite'ını render etmek hem çözünürlüğü
    hem ışığı senin yapıyor; sektörde match-3 art'ının çoğu zaten böyle
    üretiliyor.

39. **Kadraj sınır kutusunun en büyük kenarından hesaplanmaz.** Sprite
    render'ının ilk sürümü `max(x,y,z)` kullanıyordu ve muz kadrajın
    yarısında kalıyordu: eğik bakışta uzun kenarın EKRANDAKİ karşılığı
    kendisinden kısa. Doğrusu köşeleri kamera uzayına taşıyıp gerçek
    izdüşümü ölçmek — escape-3d'nin kamera oturtmasıyla aynı hesap.

40. **Arka plan sekmesinde rAF kısılıyor.** Betikli oyun testinde hamleler
    "yenmiş" gibi göründü; sebep oyun değil, sekmenin arka planda olmasıydı —
    faz makinesi yavaşladığı için dokunuşlar `phase !== 'idle'` iken gelip
    yutuluyordu. Otomasyonla test ederken sekmeyi öne almak şart, yoksa
    olmayan hata aranıyor.

41. **Reklam kazanılabilir olmalı, ölçerek.** Hedefi "10 topla" koymuştum;
    beş tür varken rastgele eşleşmenin hedef türden olma olasılığı 1/5,
    hamle başına ~0.6 hedef taşı, 12 hamlede beklenen ~7. Yani hedefe ancak
    kusursuz oynayan varırdı. 6'ya çekildi: niyetli oynayan rahat, rastgele
    oynayan kıl payı geçiyor.

42. **HUD'un altına çizilen şey sahneye ait.** 3D match'te tahta zemini
    yoktu ve taşlar gradyanda havada duruyordu. HUD canvas'ı WebGL'in
    ÜSTÜNDE olduğu için oraya çizilemezdi — taşları kapatırdı. Zemin
    sahnenin içine, taşların altına kondu.

43. **Renk kartelası normal doku değildir.** Kenney'nin 3D kitlerinde
    modeller renkli değil; hepsi tek bir küçük kartelayı paylaşıyor ve her
    yüzeyin UV'si o kartelanın içindeki minik bir kareye bakıyor. İki
    varsayılan bu tekniği bozdu: hat dokuyu normal doku sanıp küçülttü, ve
    çalışma anında mipmap + linear filtre komşu kareleri harmanladı. Sonuç,
    nesne küçüldükçe kartelanın ORTALAMASINA yaklaşması — yani gri. Ekranda
    "bazı araçların rengi var, bazılarının yok" gibi görünüyordu; aslında
    hepsi aynıydı, sadece ekrandaki boyları farklıydı. Çözüm: hatta
    `--palette` (küçültme yok) ve yüklemede en yakın komşu örnekleme,
    mipmap kapalı.

44. **Kayıpsız her zaman daha küçük değil.** Kartelayı korumak için önce
    "kayıpsız WebP'ye çevirelim" dedim: 10.5 KB PNG, 19.9 KB WebP oldu.
    Düz renkli, geniş tek renk alanlı görselde PNG zaten en iyi biçim.

45. **Animasyon budamak dosyayı BÜYÜTEBİLİR.** Karakter paketinde 27
    animasyon var, bize 4'ü lazımdı; gereksizleri atınca dosya 47.4'ten
    64.5 KB'a çıktı. Sebep: paket animasyon verisini ortak erişimcilerle
    paylaşıyor ve budama o paylaşımı bozuyor (104 erişimci -> 278).
    Paketin kendi paketlemesi benim "optimizasyonumdan" iyiydi. Ölçmeden
    optimize etme.

46. **GLB'ye gömülü doku reklam kutusunda YÜKLENMİYOR.** Modeller renksiz
    çıkıyordu; sebebi mipmap değil, güvenlik kuralıydı. GLTFLoader gömülü
    görseli okumak için geçici bir blob adresi üretip ağ isteği yapıyor,
    container'ın `connect-src` kuralı onu reddediyor
    (`THREE.GLTFLoader: Couldn't load texture blob:`). Artifact'e özgü değil
    — ağ container'ları da aynı şekilde kısıtlıyor, yani sahada da patlardı.
    Çözüm: hat dokuyu GLB'den söküp yanında ayrı taşıyor, oyun onu 2D atlasla
    aynı yoldan (data URI + `<img>`) yüklüyor. Bu adım artık koşulsuz: ayırma
    sebebini sanat değil TESLİMAT ORTAMI doğuruyor.

47. **Doku sökülen yerde `prune()` çağırma.** Doku gidince temizlik adımı
    UV'leri "kullanılmıyor" sayıp siliyor; sonra dokuyu çalışma anında
    bağlayınca her yüzey uv=(0,0)'ı, yani kartelanın sol üst köşesini
    okuyor. O köşe siyahtı ve bütün modeller simsiyah çıktı.

48. **Elle kurulan doku kenara kırpar.** Kenney kitlerinin UV'leri 0-1
    aralığının dışına taşıyor — hattın "Skipping TEXCOORD_0; out of [0,1]
    range" uyarısı tam olarak bunu söylüyordu. `RepeatWrapping` verilmeden
    modeller yine simsiyah kalıyor.

49. **Dokuyu HANGİ malzemeye bağlayacağını hat söylemeli.** Runner sahnesinde
    karakterin dokulu malzemesi ile Nature Kit'in düz renkli ağaç/kaya
    malzemeleri yan yana. Ayrım yapmadan hepsine bağlayınca ağaçlar da
    karakter dokusunu giydi. İşaret, dokuyu SÖKERKEN konuyor (`palette:`
    öneki) — çalışma anında "bu malzemenin dokusu var mıydı" bilgisi
    kalmıyor.

50. **Kenney kitleri iki farklı malzeme dünyasından geliyor.** Karakter
    UNLIT (`KHR_materials_unlit`) — ışık almıyor, kalabalıkta siluet net
    kalıyor. Doğa parçaları ise PBR ve pakette `metalness = 1` yazıyor;
    ortam haritası olmayan sahnede bu ağaçları SİMSİYAH yapıyor, çünkü
    metalik yüzeyin rengi yansımadan gelir. Yüklemede Lambert'e çevriliyor:
    hem doğru görünüyor hem PBR shader'ının maliyeti gidiyor.

51. **three.js'te ileri bakan kamerada dünya +X ekranın SOLUNA düşer.**
    Kamera +Z'ye bakarken kendi sağ ekseni dünya -X'e denk geliyor. Oyun
    mantığı x'i ekran gibi (artı = sağ) düşündüğü için parmağı sağa
    sürüklemek kalabalığı sola götürdü. Çeviri TEK YERDE, 3D görünümde
    yapılıyor; durum ve 2D yedek görünüm ekran mantığında kalıyor.

52. **DoubleSide panel arkadan AYNA görünür.** Kapı yazıları ("×2" -> "2×")
    ve duvarın "NEED 14" tabelası ters okundu. Panelin ön yüzü kameraya
    çevrilmeli; çift taraflı yapmak sorunu gizlemiyor, sadece geç fark
    ettiriyor.

53. **Parçalı animasyon kalabalığı instancing'e açıyor.** Karakterin iskeleti
    yok: paket yedi düğüm oynatıyor ve her parça katı bir kutu. Bu yüzden her
    VÜCUT PARÇASI tek bir InstancedMesh olabiliyor — bütün sol bacaklar tek
    çizim çağrısı. Kalabalık 5 kişi de olsa 30 kişi de olsa 6 çağrı. Kemikli
    bir modelde aynı numara mümkün değil: orada deformasyon vertex
    seviyesinde ve her karakterin kendi iskelet matrisleri olurdu.

54. **Aynı animasyonu herkes için ayrı hesaplama.** Kalabalıktaki herkes aynı
    koşuyu oynuyor, sadece ayakları farklı zamanda basıyor. Animasyon üç kez
    hesaplanıyor (üç gizli "verici"), ekrandaki herkes birinden pozunu
    okuyor. Tek faz robot ordusu gibi duruyordu; üç yetti.

55. **Kımıldamayan hiçbir şey ayrı nesne kalmamalı.** Koridorun kenarındaki
    ~55 ağaç/kaya/çit her biri 2-3 malzemeli ve sahne 337 çizim çağrısıyla
    açılıyordu. Hepsi statik olduğuna göre aynı malzemeyi paylaşan yüzeyler
    dünya koordinatına pişirilip tek mesh'te birleştiriliyor. Instancing ile
    birlikte 337 -> 89.

56. **Süs ölçeği modelin kendi ölçüsüyle değil, ROLÜYLE seçilir.** Ağaç ve
    kayayı aynı yükseklik aralığına (2.6-5.0) ölçekleyince kayalar koridoru
    kapatan devlere dönüştü. Engel olarak konan yayvan kaya da kapatması
    gereken aralığın iki katı yer kapladı; boy hedefi ölçeği veriyor, en
    ayrıca aralığa sıkıştırılıyor.

57. **İki tarafı da iyi olan kapı, kapı değildir.** Runner'ın ikinci
    kapısında `+3` ile `×2` yan yana duruyordu: ekranda iki yeşil panel ve
    hiç seçim yok. Ayrıca iyi taraf sırayla değişmeli (sol, sağ, sol) —
    üst üste aynı tarafta kalınca oyuncunun parmağını bir daha oynatmasına
    gerek kalmıyor.

58. **ÖLÇÜM HİJYENİ: açık sekmeleri kapat.** Sanat geçişi sırasında kare
    hızı 144'ten 54'e düştü ve suçu yeni eklediğim atmosfer katmanına
    yükledim. Sebep o değildi: tarayıcıda ondan fazla sekmede canlı WebGL
    playable duruyordu. Sekmeler kapatılınca aynı kod 144 FPS verdi
    (katmanın gerçek maliyeti 1 FPS). Bu, projedeki "değişkeni izole et"
    dersinin aynısı — sadece bu sefer değişken kodun dışındaydı.

59. **Sinema tarzı renk düzeltmesi bu görüntüyü SOLDURUYOR.** Sahneyi
    zenginleştirmek için standart hamleyi yaptım: render'ın üstündeki
    katmana üstte sıcak altta soğuk bir ton + vinyet. Sonuç solgun çıktı.
    Sebep basit: o katman sahneyle çarpılamıyor, sadece üstüne saydam boya
    sürüyor — ve saydam boya her zaman doygunluk düşürür. Hypercasual
    görüntünün istediği şeyse yüksek doygunluk. Ton katmanı kaldırıldı,
    işlevi olan vinyet ve alt perde kaldı; renk ışığa ve malzemeye taşındı.

60. **Zeminin rengini ışıktan SONRAKİ sonuca göre seç.** Zemin yatay bir
    düzlem, yani anahtar ışığı neredeyse tam alıyor. Doygunluğu artırmak
    için rengi açtım ve ekranda bembeyaz çıktı. Malzeme rengi, istediğin
    ekran değeri değil; ışıkla çarpıldıktan sonra o değeri VERECEK değer.

61. **Yarı ışıklı malzeme: unlit ile Lambert arasında.** Paket karakteri
    unlit geliyor — hiç ışık almıyor, kalabalık tek bir koyu leke gibi
    duruyordu. Sadece Lambert'e geçirince bu sefer koyulaştılar (koyu doku ×
    ışık çarpanı). Dokuyu aynı zamanda IŞIYAN harita olarak vermek ikisinin
    ortasını tutuyor: figür kendi renginin %40'ının altına düşmüyor, ışık
    onun üstüne form ekliyor.

62. **Uyarı zemine ÇİZGİ olarak yazılır, halı olarak değil.** Engelin
    önündeki kırmızı yarı saydam alan halı gibi duruyordu; koyu kahve
    yapınca toprak lekesine döndü. İnce, parlak, opak bir bant "buradan
    geçme"yi tek bakışta söylüyor.

63. **Vitrin yedi oyunu birden AÇMAMALI.** Sayfa açılışta beş kreatifi
    birden çalıştırıyordu; yan yana koşan beş oyun "portfolyo" değil
    "karmaşa" okunuyordu ve sayfa daha ilk saniyede beş oyunu birden
    yürütmek zorundaydı. Referans stüdyoların düzeni (playablefactory,
    our-works) doğru olanı yapıyor: önce KAPAK, tıklayınca tek oyun.
    Kapaklar birimlerin gerçek ekran görüntüleri — elle çizilmiş bir kapak
    burada yalan olurdu, kart neyi vaat ediyorsa tıklayınca aynısı açılmalı.
    Yedi kapak WebP olarak 96.9 KB; karşılığında sayfa açılışta hiçbir oyun
    çalıştırmıyor.

64. **Kapatılan oyun SİLİNMELİ, gizlenmemeli.** Modal kapanınca iframe
    DOM'dan çıkarılıyor. Gizlemek yeterli değil: gizli bir iframe WebGL
    bağlamını, zamanlayıcısını ve ses context'ini tutmaya devam ediyor.

65. **Birleştirilmiş sahnede yoğunluk BEDAVA.** Sanat geçişinden sonra
    ikinci bir ağaç sırası, patika kenarına çim/çiçek serpintisi ve toz
    eklendi — çizim çağrısı 89'dan **81'e DÜŞTÜ**, çünkü her yeni parça
    zaten çizilen bir malzeme kovasına düştü. Üçgen sayısı 18 binden 35
    bine çıktı, kare hızı değişmedi. Sahneyi zenginleştirmenin maliyeti
    parça sayısında değil, malzeme çeşidinde.

---

## Cihaz ölçümü (gerçek telefon)

Samsung Android, Chrome, 60 Hz ekran, LAN üzerinden servis.
**Not:** ölçüm 21.4 / 570.2 KB'lık build'de yapıldı; sonrasında ses ve iki aşamalı
kapanış eklendi, paketler birkaç KB büyüdü — yeniden ölçüm gerekiyor.

| | merge-2d | merge-3d | fark |
|---|---|---|---|
| Paket boyutu | 21.4 KB | 570.2 KB | **27×** |
| Script başlangıcı (parse) | 31 ms | 106 ms | 3.4× |
| **İlk kare** | **49 ms** | **180 ms** | **3.7×** |
| init + ilk render | 18 ms | 74 ms | 4.1× |
| FPS | 60 | 60 | — |
| min FPS | 60 | 58 | — |

**Okunuşu:**

- **3D çalışma anında bedava.** 570 KB'lık WebGL sahnesi gerçek telefonda 60 FPS'i
  tutuyor, min 58. Yani playable'da 3D'nin bedeli performans değil, **yükleme**.
- **Boyut cezası doğrusal değil.** 27 kat büyük paket yalnızca 3.7 kat geç ilk kare
  veriyor; parse ve init sabit maliyetlerin yanında eriyor.
- **180 ms hâlâ çok iyi.** Sektör hedefi 2 saniyenin altı; 3D sürüm bunun onda birinde.
  Ama bu ölçüm LAN üzerinden — gerçek reklam ağında paket mobil şebekeden inecek,
  o yüzden asıl darboğaz indirme süresi olacak, parse değil.

---

## Doğrulanan davranışlar

Chrome DevTools'ta sentetik pointer event'leriyle, **iki playable'da da**:

- 4 merge zinciri → `status: won`, `highest: 5` ✔
- Süre bitişi → `status: lost` + "SO CLOSE!" end card ✔
- CTA butonu → doğru store URL'i ✔
- End card'a dokunma → CTA sayılıyor ✔
- `+ EGG` → taş spawn oluyor, hak düşüyor ✔
- 10 sn hareketsizlik → auto-advance bir merge'i oynuyor ✔
- Portrait 390×844 ve landscape 844×414 ✔
- 3D'de beş seviyenin de mesh'i ekranda doğrulandı ✔

`escape-3d` için ayrıca:

- Yedi aracın **her biri** için `carScreenPos` → `cellAt` gidiş-dönüşü doğru
  aracı buluyor ✔ (ışın toplamanın asıl testi bu)
- Tıkalı araca dokunma → `BLOKE`, araç sayısı değişmiyor ✔
- Zincir çözümü G → C → E, ardından kalan araçlar → `status: won` ✔
- Süre bitişi → `status: lost`, iki aşamalı kapanış ✔
- TRY AGAIN → 7 araç, 20.0 s, `status: playing` ✔
- `getContext('webgl')` kapatıldığında `__renderMode: WEBGL_FALLBACK`,
  oyun 2D'de tam oynanabilir, CTA canlı ✔
- İlk kare 340 ms → 137 ms (asfalt greni), WebGL'siz yolda 58 ms ✔

`defense-2d` için:

- İki kule kurup dalgayı izleme → düşmanlar yürüyor, kuleler nişan alıyor,
  mermi isabet ediyor, para artıyor ✔
- Parası yetmeyen yuvaya dokunma → `deny`, kule kurulmuyor, yuva kızarıyor ✔
- Para biriktikçe kule ekleyen tam oyun → `status: won`, 14/14 öldürüldü,
  3 can, kazanma anı **21.1 s** ✔ (kuleler 1.2 / 5.0 / 10.1 / 14.2 s'de kuruldu)
- Hiç kule kurmadan dalga → `status: lost`, can 0, 13.0 s ✔
- TRY AGAIN → 0 kule, 3 can, $100, `status: playing` ✔
- Masaüstünde 144 FPS, ilk kare 28-46 ms ✔

`match-2d` / `match-3d` için (ikisinde de aynı senaryo):

- Hedefe oynayan betik → `status: won`, 7 toplanan, 9 hamle kalan ✔
  **İki birimde de birebir aynı log** (`h10t0 h9t7`) — paylaşılan state'in kanıtı
- Hedefe bakmadan geçerli hamle oynayan betik → yine kazanıyor (8. hamlede) ✔
- Eşleşme üretmeyen takas → taşlar geri dönüyor, hamle YANMIYOR ✔
- TRY AGAIN → 12 hamle, 0 toplanan, `status: playing` ✔
- Zincir (cascade) → tek hamlede 7 taş toplandı, ses perdesi yükseliyor ✔
- Masaüstünde 144 FPS; ilk kare 2D 19 ms, 3D 117 ms ✔

---

## Eksikler (dürüst liste)

- **Playable'da GLB yüklenmiyor** — mesh'ler primitiflerden üretiliyor. GLB yolu
  ölçüldü ve prosedürelin daha küçük olduğu doğrulandı, ama gerçek müşteri
  asset'iyle çalışan bir `GLTFLoader` varyantı henüz yok.
- **KTX2 encode'u yapılmadı** — transcoder maliyeti ölçüldü, kazanç tarafı
  literatürden alındı (deney KTX2 lehine iyimser, sonuç yine de aleyhine).
- **Art kendi IP'miz değil.** Gerçek müşteri işinde onların art'ı gelir; pipeline hazır.
- **Ses prosedürel.** WebAudio osilatörleriyle üretiliyor, tek ses dosyası yok
  (base64 mp3 100-300 KB tutardı). Gerçek işte müşterinin SFX'i gelir.
- **Gerçek ağ QA'sı yapılmadı.** AppLovin Playable Preview, Meta ve Google
  validator'ları hesap gerektiriyor.
- **Unity limiti belirsiz.** 5 MB da 10 MB da yazan kaynak var; muhafazakâr olan alındı.
- **Düşük uçlu cihaz testi yok.** Ölçüm tek bir orta-üst segment Samsung'da yapıldı;
  ucuz Android'de min FPS ve ilk kare süresi farklı çıkar.
- **`escape-3d` telefonda ölçülmedi.** Masaüstünde 144 FPS ve 137 ms ilk kare;
  gölge haritası (1024) ve 60'a yakın draw call ucuz Android'de farklı davranır.
- **`defense-2d` telefonda ölçülmedi.** Masaüstünde 144 FPS, ilk kare 28-46 ms.
- **`escape-3d` asset build'i telefonda ölçülmedi.** Masaüstünde ilk kare
  132 ms (prosedürelde 137 ms — model yüklemek ilk kareyi yavaşlatmadı,
  çünkü prosedürel taraf da geometriyi runtime'da üretiyordu).
- **Asset paketleri bizim değil.** Kenney'nin CC0 setleri kullanıldı: Tower
  Defense (2D) ve Car Kit (3D). Ticari kullanım serbest, atıf zorunlu değil;
  lisans metinleri `assets-lab/in-2d-td/` ve `assets-lab/in-3d-cars/`
  altında. Portfolyoda amaç sanat üretmek değil, GELEN sanatı işleyebildiğini
  göstermek — gerçek işte müşterinin kiti gelir ve hat aynı hattır.
- **Tek dalga.** Gerçek oyunda kule yükseltme, farklı kule tipleri ve dalga
  ilerlemesi olurdu; reklamda 21 saniyeye sığan tek dalga bilinçli.
- **Sprite render'ı tarayıcı istiyor.** `build/render-sprites.mjs` tek dosyalık
  bir sayfa üretiyor, sonuç oradan alınıp PNG'lere yazılıyor. Bir kerelik
  sanat adımı olduğu için sorun değil ama tam otomatik değil; headless bir
  GL bağlamı (`gl` paketi) eklenirse `npm run` ile koşabilir.
- **match birimlerinde özel taş yok.** Gerçek match-3'te 4'lü/5'li eşleşme
  özel taş üretir; reklamda 12 hamlelik tek hedefe gerek duyulmadı.
- **Ölçüm LAN üzerinden.** Gerçek ağda indirme süresi eklenecek.
- **Analytics yok.** Lokalizasyon yok (metin İngilizce, uluslararası başvuru hedefi).

---

## Sıradaki adımlar

1. ~~Art pass~~ ✅
2. ~~Playable #2: Three.js render~~ ✅
3. ~~Gerçek telefonda FPS + yükleme ölçümü~~ ✅ — 60 FPS ikisinde de, ilk kare 49/180 ms
4. ~~GLB + Draco + KTX2 deneyi~~ ✅ — ikisi de playable ölçeğinde zararda
5. Yeni teardown'lar — `Sample Ads/` klasörüne kayıt biriktikçe
7. ~~Vitrin sayfası~~ ✅ — üç birim gömülü (ikisi açılışta canlı), ölçümler ve bulgular sayfada
8. ~~Ses~~ ✅ prosedürel WebAudio + toggle
9. ~~Asset optimizasyon hattı~~ ✅ 2D ve 3D için ayrı araçlar, ölçülmüş sonuçlar
10. ~~Atlas çıktısını playable'a bağlamak~~ ✅ `--art atlas`, aynı pikseller 28.3 vs 264.3 KB
11. ~~PBR haritası ayıklama modu~~ ✅ `--basecolor`, BoomBox −%35
12. ~~3D asset yolunu playable'a bağlamak~~ ✅ `--art atlas`, GLB'den yükleme
13. ~~Platform uyumluluk denetimi~~ ✅ `npm run preflight` — statik kural taraması
14. ~~WebGL geri düşüşü~~ ✅ WebGL yoksa 3D birim 2D renderer'a düşüyor (+4.4 KB)
15. ~~Playable #3: izometrik 3D dünya~~ ✅ `escape-3d` — tıka-aç trafik bulmacası,
    ortografik kamera, ışınla girdi, prosedürel sahne, 2D yedek
16. ~~Playable #4: üçüncü taraf asset paketiyle 2D~~ ✅ `defense-2d` — gerçek
    zamanlı kule savunma, Kenney CC0 seti, 299 sprite'tan 37'si, 133.6 -> 23.3 KB
17. Gerçek ağ validator'larına yükleme (hesap gerekiyor — son adım)
17b. ~~Yayınlanabilir site çıktısı ve YAYIN~~ ✅ canlı:
    **https://kaenden.github.io/Playable-Ads/** — `npm run site` -> `dist/site/`
    (ilk açılış 151 KB, her birimin kendi adresi, link önizlemesi, indirilebilir
    ağ paketleri). Adımlar: [05-YAYINLAMA.md](05-YAYINLAMA.md)
18. Telefonda yeniden ölçüm — dört birim birden (masaüstü sayıları elde var,
    telefon sayıları merge için eski build'den)
19. ~~Asset yolunu tüm birimlere yaymak~~ ✅ `escape-3d` artık müşteri
    modelleriyle de derleniyor; prosedürel taraf yedek
20. ~~Aynı oyunu iki renderer'la, sanat sabit~~ ✅ `match-2d` / `match-3d` —
    43.3 vs 682.8 KB, farkın 608 KB'ı renderer
21. ~~Rig'li / animasyonlu model denemesi~~ ✅ `run-3d` — Kenney Blocky
    Characters PARÇALI animasyonlu (kemiksiz): 27 klip, `AnimationMixer` üç
    kez çalışıyor ve poz kalabalığa kopyalanıyor. Skinning maliyeti hâlâ
    ölçülmedi; bu paket iskelet taşımıyor
22. Spine runtime denemesi (ilanlarda sık geçiyor)
23. ~~Playable #5: 3D runner~~ ✅ `run-3d` — kalabalık koşusu, tek parmak yön,
    kapı/engel/duvar, Kenney Blocky Characters + Nature Kit, 796.5 KB
24. `run-3d` telefonda ölçülmedi — masaüstünde 144 FPS, 81 çizim çağrısı
25. ~~Sanat yönü geçişi (yeni asset olmadan)~~ ✅ ışık, palet, kamera, atmosfer,
    toz ve tepki — paket 796.5 -> 801.2 KB, yani 4.7 KB
26. Kendi asset üretimimiz — 2D için Invoke, 3D için görüntüden mesh; karakter
    PARÇALI kurulacak (rig yok). Pilot: aynı Crowd Rush, sadece karakter değişik
