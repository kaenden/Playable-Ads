# Yayınlama — vitrini başvuruda kullanılabilir hâle getirmek

> **Yayında:** https://kaenden.github.io/Playable-Ads/
> Depo: https://github.com/kaenden/Playable-Ads · kaynak `main` dalı `/docs`
>
> Güncellemek için: `npm run deploy` (derle, siteyi üret, `docs/`'a kopyala),
> sonra `git add -A && git commit && git push`. Bir dakika içinde canlıya geçiyor.

## Kısa cevap

**Hosting'e para vermene gerek yok.** Bu bir statik site: sunucuda çalışan
hiçbir şey yok, veritabanı yok, arka uç yok. Sadece dosyaları servis edecek
bir yer lazım ve bunun ücretsiz seçenekleri fazlasıyla yeterli.

**Alan adına değer.** Zorunlu değil ama yılda 200-350 TL civarı ve başvuruda
`adinsoyadin.dev` yazan bir link ile `rastgele-isim-3f2a.netlify.app` yazan
bir link aynı izlenimi bırakmıyor.

---

## Google Drive ve Notion neden olmuyor

Bu ikisi ilk akla gelenler ama **oyunları çalıştıramıyorlar.**

**Google Drive** HTML dosyasını ÇALIŞTIRMIYOR, indiriyor. Drive'ın site
barındırma özelliği 2016'da kapatıldı. Paylaştığın link tıklandığında karşı
taraf "bu dosyayı indir" ekranı görür; playable'ın tamamı — dokunmak, oynamak,
CTA'ya basmak — ölür. Bu işin bütün değeri oynanabilir olmasında, o yüzden
Drive burada işe yaramıyor.

**Notion** da dosyayı çalıştırmıyor. Notion'a HTML yükleyebilirsin ama o da
indirilebilir bir ek olarak durur. Notion'ın `/embed` bloğu ise ancak
BAŞKA BİR YERDE YAYINLANMIŞ bir adresi gömebiliyor — yani Notion'ı kullanmak
istesen bile önce gerçek bir host'a ihtiyacın var.

**İkisinin de yeri var:** Drive, biri "paketi gönderir misin" dediğinde zip'i
göndermek için; Notion, yazılı bir CV/vaka çalışması sayfası istersen. Ama
oyunların yaşadığı yer statik bir host olmak zorunda.

---

## Üç seçenek

| | Ücret | Kurulum | Neden |
|---|---|---|---|
| **GitHub Pages** | Ücretsiz | Depo + tek ayar | Kod da orada duruyor. Bu projede asıl değer mühendislikte; README'deki 65 ders başvurunun en güçlü parçası |
| **Cloudflare Pages** | Ücretsiz | Klasör sürükle | En iyi ücretsiz kota, en hızlı CDN, alan adı bağlamak bedava |
| **Netlify** | Ücretsiz | Klasör sürükle | En kolayı. `app.netlify.com/drop` sayfasına klasörü bırak, link hazır |

**Öneri: GitHub Pages.** Sebep hosting değil, GÖRÜNÜRLÜK. Playable ads
geliştirici ilanlarına başvururken karşı tarafın merak ettiği şey "bu kişi
gerçekten yazabiliyor mu"; depo bu sorunun cevabı. Vitrin oynanabilir işi
gösteriyor, depo onu kimin yazdığını gösteriyor.

Acelen varsa Netlify Drop ile 2 dakikada linke sahip olursun, sonra GitHub'a
taşırsın. İkisi birbirini engellemiyor.

---

## Ne yayınlanıyor

İki farklı çıktı var ve **başvuruda kullanılacak olan `dist/site/`.**

```
npm run build:assets     # bütün paketleri üret
npm run site             # dist/site/ klasörünü üret
npm run serve            # http://localhost:8080/site/ ile yerelde dene
```

| | `showcase/index.html` | `dist/site/` |
|---|---|---|
| Ne | Tek dosya, her şey içinde | Gerçek site, parçalı |
| İlk açılış | 5.3 MB | **151 KB** |
| Oyunlar | Sayfanın içinde gömülü | Tıklanınca kendi adresinden |
| Her birimin linki | yok | **var** (`/u/gate-crashers/`) |
| Link önizlemesi | yok | **var** |
| Nerede kullanılır | Artifact, e-posta eki, çevrimdışı | Web sitesi |

Tek dosya sürümü hâlâ lazım: internetin olmadığı bir yerde açmak, e-postaya
eklemek ya da "tek dosya" istendiğinde göndermek için.

### `dist/site/` içinde ne var

```
index.html            vitrin — 7 kapak, tıklayınca oyun açılıyor
covers/*.webp         kapaklar (toplam 97 KB)
u/gate-crashers/         her birim kendi adresinde, tam ekran
og/*.png              link önizleme kartları
dl/*.zip              ağ paketleri, indirilebilir
```

`u/` altındaki her klasör başlı başına çalışan bir playable. Yani birine
"şu runner'a bak" derken sadece o birimin linkini gönderebilirsin.

---

## GitHub Pages ile adım adım

```bash
git init
git add .
git commit -m "Playable ads lab"
git branch -M main
git remote add origin https://github.com/<kullanici>/playable-ads.git
git push -u origin main
```

`.gitignore` hazır: `dist/`, `node_modules/`, indirilen asset zip'leri,
Khronos örnek modelleri ve referans reklam videoları depoya girmiyor.
Depoya giren yaklaşık **17 MB**.

Sonra siteyi yayınlamak için iki yol var:

**Yol A — `docs/` klasörü (en basit).** `dist/site/` içeriğini `docs/`
klasörüne kopyala, commit'le, GitHub'da **Settings → Pages → Source: main
branch /docs**. Adres: `https://<kullanici>.github.io/playable-ads/`

**Yol B — GitHub Actions.** Her push'ta build alıp yayınlar. Daha temiz ama
kurulumu biraz daha uzun; A ile başlayıp sonra geçmek mantıklı.

> `dist/` gitignore'da olduğu için Yol A'da `docs/` ayrı bir klasör olarak
> depoya giriyor. Kasıtlı: yayınlanan sürümün ne olduğu depoda görünür kalıyor.

---

## Alan adı

Alırsan sıra şöyle:

1. Alan adını al (Cloudflare Registrar maliyetine satıyor, Namecheap de olur).
2. Host panelinde "custom domain" olarak ekle, verdiği DNS kaydını gir.
3. **Siteyi bir kez daha üret:**

```bash
node build/site.mjs --base https://alanadin.com
```

Bu adım önemli. `--base` verilmediğinde link önizleme görselinin adresi
GÖRECELİ yazılıyor ve bazı platformlar (özellikle LinkedIn ve bazı e-posta
istemcileri) göreceli adresi okumuyor — link çıplak metin olarak görünüyor,
kart açılmıyor. Alan adı belli olduğu anda bu bayrakla yeniden üret.

**İsim önerisi:** kendi adın en güvenlisi. "playablestudio" gibi bir stüdyo
adı, tek kişilik bir portfolyoda karşı tarafa yanlış beklenti veriyor.

---

## Linki başvuruda nasıl kullanmalı

- **Tek link gönder, ana sayfayı.** Karşı taraf hangi işe bakacağını kendi
  seçsin; yedi ayrı link göndermek okunmuyor.
- **Telefonda test et.** Bu işler telefonda oynanıyor ve ilan sahibi de
  telefonda açacak. İlk açılış 151 KB, yani mobil veriyle de anında geliyor.
- **Depo linkini ayrı bir satırda ver.** Vitrin işi gösteriyor, depo işi
  kimin yaptığını gösteriyor; ikisi farklı sorulara cevap.
- **Paketleri indirtme, bahset.** Sayfanın altında zip'ler duruyor; birine
  ihtiyacı olan zaten iner. "Şu ağın formatında da hazır" demek yeterli.

---

## Kalan tek dış adım

Gerçek ağ validator'ları (AppLovin Playable Preview, Meta, Google) hesap
gerektiriyor. `npm run preflight` statik kuralları tarıyor ve 100 pakette 0
red sebebi çıkıyor — ama bu, ağın kendi aracının yerine geçmiyor. Hesap
açıldığında son kontrol orada yapılmalı.
