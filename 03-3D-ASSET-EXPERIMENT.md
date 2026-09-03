# 3D Asset Deneyi: Draco ve KTX2 playable'da kârda mı?

**Tarih:** 1 Eylül 2026
**Soru:** Web'de standart olan GLB + Draco + KTX2 zinciri, tek dosya playable'da
da doğru mu? Yoksa decoder yükü tasarrufu yiyor mu?
**Yöntem:** Tahmin yok — ölçüldü. Tekrarlanabilir:
`node build/glb-probe.mjs` → `node build/draco-probe.mjs`

---

## Neden bu soru playable'a özgü

Normal bir web sitesinde Draco ve KTX2 decoder'ları CDN'den yükleniyor, sayfanın
kendi boyutuna girmiyor. **Playable'da network isteği yasak** — her şey tek HTML'e
inline. Yani decoder'ın kendisi de bütçeden yiyor, üstelik base64 ile **%33 şişerek**.

Kimse bu hesabı yazmıyor çünkü web dünyasında geçerli değil. Playable'da belirleyici.

---

## Ölçüm 1 — GLB boyutları

Prosedürel ejderha üç farklı yoğunlukta GLB'ye export edildi (Three.js GLTFExporter):

| Model | Üçgen | GLB ham | GLB gzip | base64 (inline hali) |
|-------|-------|---------|----------|----------------------|
| lowpoly | 1.078 | 42.0 KB | 8.9 KB | 56.0 KB |
| normal | 2.918 | 84.8 KB | 22.1 KB | 113.1 KB |
| highpoly | 15.374 | 361.0 KB | 149.7 KB | 481.4 KB |

## Ölçüm 2 — Draco, gerçek sıkıştırma

| Model | ham GLB | +Draco | kazanç | kazanç (base64) | oran |
|-------|---------|--------|--------|-----------------|------|
| lowpoly | 42.0 KB | 14.3 KB | 27.7 KB | 36.9 KB | %66 |
| normal | 84.8 KB | 20.8 KB | 64.0 KB | 85.3 KB | %75 |
| highpoly | 361.0 KB | 48.8 KB | 312.3 KB | 416.4 KB | **%86** |

Draco gerçekten çok iyi sıkıştırıyor. Sorun orada değil.

## Ölçüm 3 — Inline decoder maliyeti

three.js'in kendi dağıttığı dosyalar:

| Decoder | Ham | base64 (inline zorunlu) |
|---------|-----|-------------------------|
| Draco (`draco_decoder.wasm` + `draco_wasm_wrapper.js`) | 336.4 KB | **448.6 KB** |
| KTX2 / Basis (`basis_transcoder.wasm` + `.js`) | 571.2 KB | **761.5 KB** |

> Not: Draco'nun wasm yerine saf JS decoder'ı (`draco_decoder.js`) **702 KB** —
> wasm desteklemeyen webview'lar için fallback koyarsan maliyet ikiye katlanıyor.

---

## Sonuç

**En iyi senaryoda bile Draco zararda.** 15 bin üçgenlik modelde 416 KB
kazandırıyor, decoder 448 KB tutuyor — **32 KB net zarar.** Daha küçük modellerde
fark uçuruma dönüyor.

### Başabaş noktaları

| | Kendini ödemeye başladığı yer |
|---|---|
| **Draco** | ham GLB geometrisi **~390–450 KB**'ı aşarsa (ölçülen %75–86 oranlarına göre) |
| **KTX2** | ham texture **~715 KB**'ı aşarsa |

Bir playable'ın **tüm** bütçesi 5 MB, Meta'da index için 2 MB. Bu eşiklere
ulaşan bir asset zaten bütçeyi patlatıyor. Yani:

> **Playable ölçeğinde Draco ve KTX2 kullanılmaz. Web'deki refleks burada yanlış.**

### Asıl kazanan: mesh'i küçültmek

| Yaklaşım | Toplam inline maliyet |
|----------|----------------------|
| highpoly GLB + Draco | 65 KB + 449 KB decoder = **514 KB** |
| highpoly GLB, sıkıştırmasız | **481 KB** |
| **lowpoly GLB, sıkıştırmasız** | **56 KB** |
| **prosedürel mesh (bizim yaptığımız)** | **~0 KB** (sadece üreten kod) |

Decimate + normal map bake, Draco'dan **9 kat** daha etkili. Sıkıştırma değil,
**az veri** kazanıyor.

---

## Ölçüm 4 — Texture formatı

512² ve 1024² prosedürel karakter texture'ı, tarayıcıda encode edildi:

| Boyut | PNG | WebP q85 | JPEG q85 | PNG base64 | WebP base64 |
|-------|-----|----------|----------|------------|-------------|
| 512×512 | 372.6 KB | **41.4 KB** | 57.7 KB | 496.8 KB | **55.2 KB** |
| 1024×1024 | 1135 KB | **93.0 KB** | 156 KB | 1513 KB | **124 KB** |

**WebP, PNG'nin 9–12 katı küçük ve decoder maliyeti SIFIR** — tarayıcı natively
açıyor. KTX2'nin asıl avantajı dosya boyutu değil, GPU belleğinde sıkışık kalması;
20 saniyelik bir reklamda VRAM sorun değil, bayt sorun.

**Kural: playable'da texture = WebP.** Çok eski webview endişesi varsa JPEG
fallback; PNG sadece alpha şart olan küçük UI parçaları için.

---

## Karar tablosu — playable'da 3D asset

| Durum | Yap |
|-------|-----|
| Model geliyor (FBX/GLB) | Blender'da decimate → hedef 1–3k üçgen, GLB olarak inline |
| Detay kaybı sorun | Yüksek detayı normal map'e bake et, mesh düşük kalsın |
| Draco düşünüyorsun | **Yapma** — 390 KB+ ham geometri yoksa zarar |
| KTX2 düşünüyorsun | **Yapma** — 715 KB+ ham texture yoksa zarar |
| Texture | WebP q80–85, 512² tercih, 1024² üst sınır |
| Alpha gerekiyor | WebP alpha destekliyor; PNG'ye düşme |
| Şekil basit / stilize | Prosedürel üret, asset hiç olmasın |

---

## Bu deneyin sınırları

- Test modeli **texture'sız** ve küre ağırlıklı; Draco böyle geometride
  olağanüstü iyi çalışıyor. Karmaşık, UV'li bir karakterde oran daha düşük olur —
  **yani Draco daha da erken zarara geçer**, sonuç güçleniyor.
- Düşük poly'nin görsel kalitesi ayrı bir tartışma; burada sadece bayt ölçüldü.
- KTX2 için gerçek encode yapılmadı (toktx binary'si yok); transcoder maliyeti
  ölçüldü, kazanç tarafı literatürdeki %70–85 aralığından alındı. Başabaş
  hesabı bu yüzden KTX2 lehine iyimser — gerçekte daha kötü.
- WebP encode'u tarayıcının encoder'ı ile yapıldı; `cwebp` ile birkaç KB oynayabilir.
