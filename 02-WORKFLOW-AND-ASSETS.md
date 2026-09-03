# Üretim Akışı: Kim Ne Veriyor, Sen Ne Yapıyorsun

**Tarih:** 1 Eylül 2026
Kaynaklar ajans süreç sayfaları, ağ dokümanları ve iş ilanları. Ajans sayfaları
kendi süreçlerini pazarlıyor — yön doğru, detay stüdyodan stüdyoya değişir.

---

## 1. Kısa cevap

**Müşteri sana oyunu vermiyor. Referans veriyor. Sen oyunu sıfırdan yeniden yazıyorsun.**

Ajanslar bunu açıkça yazıyor: müşteri görsel referans, gameplay kaydı ve art asset
veriyor; **motor kodu, sunucu kodu veya oyun mantığı verilmiyor.** eJaw'ın ifadesiyle
stüdyo "mevcut oyun kodunu port etmek yerine bağımsız bir yeniden inşa" yapıyor —
bu hem IP korumasını çözüyor hem de 5 MB'a sığmanın tek yolu.

**Asset'i küçülten sensin.** Müşteri optimize edilmiş asset göndermiyor. Matej
Lancaric'in UA rehberindeki "yaygın hatalar" listesinde madde madde geçiyor:
*"devasa optimize edilmemiş dosyalar gönderip developer'ın ayıklamasını beklemek."*
İlan tarafında da aynı: X-FLOW'un Playable Ads Developer ilanında sorumluluklar
arasında **"asset guideline'ları oluşturmak"** var — yani asset spec'ini yazan da sensin.

---

## 2. Rol dağılımı

| Rol | Ne yapar | Kimde |
|-----|----------|-------|
| UA / Creative strateji | Rakip analizi, hangi açı test edilecek, bütçe | Müşteri |
| Product marketing | Tek cümlelik vaat, hedef kitle | Müşteri |
| Creative producer | Brief, storyboard, iterasyon yönetimi | Ajans / stüdyo |
| Game designer (creative) | Hangi mekanik, hangi 20 saniye | Ajans / stüdyo |
| **Artist** | Karakter, UI, arka plan, animasyon | Ajans / stüdyo (**sen değilsin**) |
| **Playable developer** | **Mekanik kodu, asset entegrasyonu, optimizasyon, ağ paketleme, red çözümü** | **Sen** |
| QA | Cihaz matrisi, yükleme, dokunma, oryantasyon | Ajans / ad ops |
| Ad ops | Yükleme, validator, kampanya | Müşteri UA ekibi |

Küçük ekiplerde designer + developer + QA aynı kişi oluyor. Stüdyo içi (in-house)
pozisyonlarda genelde marketing ekibine bağlısın, oyun ekibine değil.

---

## 3. Müşteriden istenecekler (checklist)

Bunu hazır tutmak mülakatta da işte de fark yaratıyor:

**Zorunlu**
- [ ] Hedef: hangi metrik? (IPM, CTR, D1) Hangi ağlar? Hangi ülkeler?
- [ ] Öne çıkarılacak **tek** mekanik
- [ ] Gameplay kaydı (temiz, UI'sız tercih edilir)
- [ ] Store linkleri (iOS + Android ayrı)
- [ ] Marka kiti: logo (vektör), renk paleti, font adı/lisansı

**Art**
- [ ] Karakter/obje görselleri — **kaynak dosya** (PSD/AI/SVG), export değil
- [ ] Spine kullanıyorlarsa: `.json`/`.skel` + `.atlas` + atlas PNG'leri
- [ ] UI kit: buton, panel, ikon (9-slice kaynakları dahil)
- [ ] Style guide / referans ekran görüntüleri

**3D ise ayrıca**
- [ ] Model: **FBX veya GLB**, tercihen düşük poly LOD'u
- [ ] Rig + animasyon listesi: hangi klipler gerekli (idle, merge, win — 3'ü geçmesin)
- [ ] Texture'ların kaynağı (4K PSD gelirse sen 512'ye ineceksin)
- [ ] Shader referansı — özel shader'lar yeniden yazılacak, aynen taşınmıyor

**Sık atlanan ama kritik**
- [ ] Font lisansı web'de kullanılabilir mi? (çoğu oyun fontu kullanılamıyor)
- [ ] Ses gerekli mi? (ağlar etkileşim öncesi ses istemiyor)
- [ ] Lokalizasyon: kaç dil, metin uzunluğu değişkenliği

---

## 4. 2D asset akışı — pratikte ne yapıyorsun

```
Müşteriden gelen               Senin yaptığın                     Çıktı
─────────────────────────────────────────────────────────────────────────────
PSD / 4K PNG'ler        →   trim + gereksiz katman at        →   temiz PNG
temiz PNG'ler           →   atlas'a paketle (TexturePacker)  →   atlas.png + json
atlas.png               →   kalite ayarı: PNG8 / WebP /          küçültülmüş atlas
                            quantize, gözle karşılaştır
küçültülmüş atlas       →   base64 → tek HTML'e inline       →   index.html
Spine json + atlas      →   runtime seç (pixi-spine),        →   sahnede animasyon
                            gereksiz slot/skin'leri temizle
```

Kritik nokta: **base64 %33 şişiriyor.** 3 MB'lık bir atlas HTML içinde 4 MB yer
kaplıyor ve 5 MB limitinde yer kalmıyor. Bütçeyi asset'in *inline edilmiş* haline
göre hesaplaman gerekiyor, ham dosya boyutuna göre değil.

İkinci nokta: **çoğu playable'da atlas bile gerekmiyor.** Bizim Merge Dragons
20 KB, tek raster yok — beş karakter prosedürel çiziliyor. State.io'nun kendi
playable'ı da düz vektör (bkz. [Sample Ads teardown](Sample%20Ads/01-state-io-mintegral-teardown.md)).
Art'ı sadeleştirmek, sıkıştırmaktan daha etkili.

---

## 5. 3D akışı — modeller, rigler

İki ayrı yol var ve ilanlar ikisini de arıyor.

### Yol A — Web-native (Three.js / PlayCanvas / Cocos Creator)

Müşteriden FBX/GLB alırsın, sen web'e uygun hale getirirsin:

| Adım | Araç | Kazanç |
|------|------|--------|
| Mesh sadeleştirme | Blender decimate / gltfpack | hedef **≤50k üçgen**, playable'da genelde çok daha az |
| Yüksek detayı normal map'e bake | Blender | silüet korunur, poly düşer |
| Geometry sıkıştırma | ~~Draco~~ | playable'da **zararda**, bkz. §aşağı |
| Texture sıkıştırma | **WebP** (KTX2 değil) | PNG'nin **9–12 katı** küçük, decoder maliyeti sıfır |
| Texture çözünürlüğü | — | ≤2048, playable'da genelde 512–1024 |

Sektör literatüründe standart reçete "Draco + KTX2 + 50k tri sadeleştirme →
tipik asset 1.8–3.5 MB" şeklinde. **Bu reçete normal web için doğru, playable için
değil** — sebebi aşağıda.

> **ÖLÇÜLDÜ — playable'a özgü tuzak doğrulandı.** Draco ve KTX2 decoder'ları
> playable'da CDN'den gelemiyor (network isteği yasak), tek HTML'e inline olmak
> zorundalar: Draco 448 KB, KTX2 761 KB (base64 dahil). Ölçümde en iyi Draco
> kazancı bile 416 KB'da kaldı — **net zarar.** Başabaş noktası ~390 KB ham
> GLB geometrisi; oraya ulaşan asset zaten bütçeyi patlatıyor.
> **Playable'da Draco/KTX2 kullanma; mesh'i küçült ve texture'ı WebP yap.**
> Tüm sayılar ve karar tablosu: [03-3D-ASSET-EXPERIMENT.md](03-3D-ASSET-EXPERIMENT.md)

**Rig/animasyon gerçeği:** playable'da tam rig taşınmıyor. Pratikte ya animasyon
bake edilip vertex/skinned mesh olarak gömülüyor, ya da kemik sayısı ciddi
düşürülüyor. 20 saniyelik bir reklamda 2-3 klipten fazlası gerekmiyor:
idle, aksiyon, kazanma.

### Yol B — Unity → Unity Playworks (eski Luna Labs)

Oyunun Unity projesini alıp plugin ile export ediyorsun. Mevcut oyun kodunu
kullanabiliyorsun, ama **desteklenmeyenler listesi uzun** (resmî dokümandan):

- DLL / C++ plugin yok → C# kaynağa çevir
- Ads / analytics SDK'ları desteklenmiyor → stub'la
- **NavMesh yok** → A* veya elle mantık
- **HDRP yok** → URP veya built-in
- Eski Unity GUI yok, **DOTS/ECS yok**
- Precompiled shader hata veriyor
- WebGL 1.0'da ışıklar toplanıyor → sahne fazla aydınlık çıkıyor
- **Kemik animasyonlarında kısıt var → "animasyonu skinned mesh'e yeniden bake et"**
- Bridge.NET transpile, sadece **C# 7.0**; destructor, goto, inline cast yok

Yani "Unity projesini ver, plugin halleder" değil. Playable için ayrı, sadeleştirilmiş
bir Unity sahnesi kuruluyor — job ilanlarındaki "build lightweight minigames and
prototypes in Unity" ifadesi tam olarak bunu kastediyor.

---

## 6. Sen tam olarak neyi teslim ediyorsun

Freelance/kontrat işinde teslimat paketi:

- Tüm HTML5 kaynak kodu + production build
- **Her ağ için ayrı paket** (Meta, Google UAC, AppLovin, Unity, ironSource, Mintegral, TikTok)
- A/B için 2-3 varyant (genelde fiyata dahil)
- Cihaz testi sonuçları
- IP müşteride kalır, lisans ücreti yok

Süre: standart playable **5–12 gün**; ajans turnaround **2–4 hafta**.
Fiyat: şablon ~$490, karmaşık özel mekanik ~$1.990, uçtan uca dış partner $3.000–8.000.

---

## 7. Bizim projeye etkisi

Portfolyoda **hem art hem dev bizde** — bu normalde tek kişinin işi değil ama
portfolyo için avantaj: "asset gelmediğinde de üretebiliyorum" demek oluyor.

Gerçek işte art gelecek. O yüzden [art.ts](src/game/art.ts) `sprite(level, px)`
arayüzünün arkasında duruyor: yarın müşteri atlas gönderdiğinde sadece o dosya
değişecek, `view2d.ts` ve `state.ts` aynı kalacak.

**Playable #2 (Three.js) için doğrudan sonuç:** modelleri de biz üreteceğiz, o yüzden
düşük poly başlayıp Draco/KTX2'yi *ölçerek* eklemek gerekiyor — decoder yükü
tasarrufu yiyor mu, build alıp tartacağız. Bu ölçüm README'ye ders olarak girecek.
