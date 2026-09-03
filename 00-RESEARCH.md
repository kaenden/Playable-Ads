# Playable Ads — Kapsam Araştırması
**Tarih:** 1 Eylül 2026 · **Amaç:** Playable ads pozisyonlarına başvurmak için portföy projesi kapsamını belirlemek

---

## 1. Playable ad nedir?

15–60 sn'lik, oyunun tek bir çekirdek mekaniğini oynatan, tıklanabilir HTML5 reklam birimi.
Video reklamdan farkı: kullanıcı **oynuyor**, sonra store'a gidiyor.

### Anatomi (sektör standardı 5 parça)
| # | Parça | Süre | Not |
|---|-------|------|-----|
| 1 | Intro / hook | 0–3 sn | Duygusal çerçeve ("kralı kurtar", "gemiyi batırma") |
| 2 | Tutorial | ≤5 sn | "Tap to jump" + loop animasyon, yazı minimum |
| 3 | Core mechanic | 15–30 sn | **Tek** mekanik. Hypercasual'da <15 sn, karmaşıkta ~28 sn |
| 4 | Feedback | — | Kazanma/kaybetme, puan, progress bar |
| 5 | End card + CTA | — | Install butonu; interaktif end card statik'e göre +%47 CTR |

**Altın kural:** Time-to-Fun < 10 sn. Install butonu baştan sona görünür kalır.

### Neden çalışıyor (rakamlarla)
- Playable'lar, en çok harcayan oyun reklamverenlerinde install oranında video dışı formatların **8 katına** kadar çıkıyor (Liftoff 2025 Creative Index).
- HTML5 playable → dönüşümde **+%123**, CPI'da **−%11** (Room 8 verisi).
- Casual türlerde CTR **%30–40** daha yüksek.
- AppLovin 2025 publisher benchmark: tier-1'de **$10–30 eCPM**, video'ya göre install oranında **+%30–50**.

> Uyarı: bu oranların hepsi satıcı (vendor) kaynaklı. Yön doğru, kesin değerler pazarlama malzemesi.

---

## 2. Teknik gerçeklik — işin zor kısmı burası

Playable ad bir web oyunu **değildir**. Fark tam olarak burada:

### Ağ başına spec'ler
| Network | Format | Boyut limiti | CTA API |
|---------|--------|--------------|---------|
| Meta (Facebook) | tek .html | 5 MB (index ≤2 MB) | `FbPlayableAd.onCTAClick()` |
| Google Ads (UAC) | HTML5 ZIP | 5 MB, max 512 dosya | `ExitApi.exit()` |
| Unity Ads | **tek** index.html | 5 MB (bazı kaynaklar 10 MB diyor — doğrula) | MRAID |
| AppLovin | inline HTML | 5 MB | MRAID 2.0 + SDK tracking |
| ironSource | ZIP / inline | 5 MB | MRAID 2.0 |
| Mintegral | ZIP / inline | 5 MB | MRAID |
| TikTok | — | — | 10 sn hareketsizlikte auto-advance önerisi |

### Herkesin ortak şartları
- **MRAID 2.0/3.0 uyumu** (IAB standardı) — aynı unit mediation yığınında rebuild'siz koşsun.
- **Tek dosyaya inline**: tüm asset'ler base64. Base64 boyutu **~%33 şişirir** — bütçeyi buna göre kur.
- **Sıfır network isteği** (XHR yok, CDN yok, font CDN yok).
- Portrait + landscape, çoklu aspect ratio.
- Yükleme < 2 sn.

### Bizim için kritik ölçüm
Elimizdeki 8 oyunun tamamı **Phaser 3**. Chainshot'ta ölçtüm:

```
phaser chunk : 1.5 MB (ham) / 330 KB (gzip)
oyun kodu    : 26 KB
dist toplam  : 1.5 MB – 31 MB (Zeno Brawl)
```

Playable'da gzip seni kurtarmaz, çünkü limit paketin kendisinde. **Phaser'ı inline etmek 5 MB bütçenin ~1.5 MB'ını daha ilk satırda yakar.**
→ Sektörün PixiJS'i bu yüzden tercih ettiği ilanlardan da net görünüyor. Playable tarafında Phaser değil **PixiJS / saf Canvas** ana akım; 3D'de **Three.js / Babylon.js / PlayCanvas**.

---

## 3. Kim kullanıyor? (Reklamveren tarafı)

Playable artık niş değil, varsayılan format:
- En çok gelir getiren oyunlarda, harcamaya göre **top-30 kreatifin %56'sı playable** (Ekim 2025) — bir yıl önce %30'du.
- Rewarded video + playable interstitial birlikte tüm mobil reklam harcamasının **~%40'ı**.
- 2025'te aylık ortalama mobil oyun reklamvereni **84.000+** (+%21,9 YoY).

**Playable hacmine göre ağlar (Şub 2026, Lancaric):** AppLovin 589 · Unity 259 · Google 213 · Mintegral 206 · Facebook 205.

**Format olarak en çok koşan mekanikler:** Merge 3D (%15), Image Carousel (%11), Spin the Wheel (%9); ayrıca Kitchen Cleanup Merge, jigsaw/puzzle, onboarding anketi, karakter seçimi, video gallery end card.

**Aktif büyük reklamverenler:** Dream Games (Royal Match, Royal Kingdom — Şubat 2026'da playable'a "all in" giden isim), Playrix (Homescapes/Gardenscapes), Moon Active, Scopely (Monopoly GO!), Tripledot (AppLovin'in oyun portföyünü $800M'a aldı), Century Games, Voodoo, Rollic, Good Job Games, Superplay, King, Rovio, Zynga, Playtika.

**Genişleme:** "try before install" mekaniği oyun dışına da taşınıyor — perakende, finans, utility.

---

## 3.5. 2D mi, 3D mi?

**Kamuya açık net bir yüzde yok** — hiçbir kaynak "playable'ların %X'i 3D" demiyor. Ama dolaylı sinyaller tutarlı:

**Hacimde 2D önde, ama tek tek en büyük şablon 3D.** PlayableMaker'ın aylık template dağılımı:
| Ay | 1. | 2. | 3. |
|----|----|----|----|
| Oca 2026 | Blockdoku Blast %13 (2D) | Slot Machine %11 | Item Sort %11 (2D) |
| Şub 2026 | **Merge 3D %15** | Image Carousel %11 (2D) | Spin the Wheel %9 |

Yani 3D merge tek başına en çok koşan şablon, ama 2D şablonların toplamı daha büyük. Ay ay da oynuyor.

**Neden 3D daha baskın "hissediliyor":** 3D'yi çalıştıran türler (hybrid-casual, merge, idle arcade, simülasyon) reklam harcamasında agresif ve kreatifleri görsel olarak ayırt edilebilir. Hybrid-casual 2026'nın tanımlayıcı trendi — IAP geliri %20 artışla $4,2 mlr, top 10 başlıkta YoY büyüme %67–100. Bu türler kullanıcıyı reklamla satın alıyor, dolayısıyla feed'de onları daha çok görüyorsun. Buna karşılık en çok **para harcayan** oyunlar (Royal Match, Homescapes, Monopoly GO!) match-3/board — bunların playable'ları ağırlıkla 2D.

**Üretim gerçeği:** 3D playable 5 MB'a sığdırmak ciddi iş — GLTF/GLB/FBX, draco sıkıştırma, texture atlas, agresif poly bütçesi. Sektör iki yoldan gidiyor:
- **Web-native 3D:** Three.js / PlayCanvas / Babylon.js / Cocos Creator — kontrol tam, boyut yönetilebilir.
- **Unity → export:** Luna Labs'ın **Unity Playworks** eklentisi (Unity ürünü oldu). Unity'de yap, plugin tüm ağlar için playable'a çevirsin. PlayCanvas ve Three.js loader'larını patch'liyor. Hâlâ 5 MB limiti var, asset paneli boyut yönetimi için.

**İş ilanı sinyali — kritik olan bu:** 3D, aranan ama az bulunan taraf.
- MY.GAMES: "3D HTML5 Playable Ads Developer", 6–8 yıl
- Goodgame Studios: "3D playable ads from scratch" + Unity/C#
- 52 Entertainment: Senior Unity Developer (Playable Ads)
- **Unico Studio (Türkiye, %100 remote): "Senior 3D Playable Ads Developer (Three.js / Cocos Creator)", 2–3 yıl, portfolyosuz başvuru incelenmiyor, canlı tarayıcı linki tercih ediliyor**
- iLogos: "Playable Ads Developer (PixiJS / **Three.js**)" — ikisini birden istiyor

Mid seviye ilanların çoğu 2D'yi taban, 3D'yi ayırt edici sayıyor. Aggregator maaş verileri 3D'yi daha yüksek gösteriyor ama o rakamlar güvenilir değil; asıl sinyal **3D isteyen ilan sayısının 3D yapabilen aday sayısından fazla olması.**

**Bizim için sonuç:** Portfolyo 2D ile başlamalı (hızlı bitiyor, pazarın hacim tarafı, ilk uçtan uca deneyimi risksiz veriyor), ama **en az bir Three.js 3D playable** şart — ayırt edici olan orası.

---

## 4. Kim işe alıyor? (3 kanal)

### A. Oyun stüdyoları — in-house playable ekibi
| Şirket | Rol | Lokasyon / model |
|--------|-----|------------------|
| Voodoo | Playable Ads Developer | Paris / hibrit |
| Tripledot (PeopleFun) | AI Playable Ads Developer | Minsk — ilan kapandı, tekrar açılır |
| Gameloft | HTML5 Game Dev (Playable Ads) + Ad Developer | çoklu ofis |
| MY.GAMES | 3D HTML5 Playable Ads Dev (6–8 yıl) | worldwide remote |
| ZiMAD | Playable Ads Developer (junior, 1+ yıl) | remote |
| G5 Games | Freelance HTML5 Dev (Playable Ads) | remote, lokasyon şartsız |
| X-FLOW (Happy Color) | Playable Ads Developer | **İzmir** / EMEA + Varşova |
| Ten Square Games | Playable Ads Developer (f/m/d) | Polonya |
| Scorewarrior | Playable Ads Developer | Kıbrıs relokasyon |
| 52 Entertainment | Senior Unity Developer (Playable Ads) | Avrupa |
| Goodgame Studios | Marketing Developer: Video & Playable | Hamburg / tam remote |
| Estoty | Playable Ad Game Developer | Riga |
| Wildlife Studios | in-house playable ekibi (teknik blog yayınlıyor) | Brezilya |

### B. Playable / kreatif ajanslar — freelance ve kontrat kapısı
- **Playable Factory** — İstanbul kurulu (2018), 90.000+ playable, 30 mlr+ impression; Nisan 2026'da Ürdünlü **Tamatem** tarafından satın alındı. Ürünler: Playable / Flex / Ready / Data. *Türkiye'de bu alanın merkezi.*
- **Sett** — AI-first kreatif stüdyo, $27M yatırım; müşteriler Superplay, Tripledot, **Rollic, Good Job Games**. Davetle çalışıyor.
- **Liniad** — Zynga, Rovio, Scopely, Playtika, Warner Bros.
- **mraid.io** — proje bazlı; portföy Ubisoft, Disney, Marvel, King, Rovio, Cartoon Network. **Fiyatı açık: şablon $490 → özel mekanikli karmaşık playable $1.990.**
- **iLogos** (Middle Dev, PixiJS — worldwide remote), **Medialicious** (remote Playable Ad Developer), **RetroStyle Games**, **eJaw** (white-label), **OmiSoft**, **PlayJoy**, **Kevuru**.

### C. Ad network / adtech tarafı
**Smadex** — "Creative Technologist (Playable Ads Developer)", remote. Ayrıca AppLovin (Luna), Mintegral/Nativex (Playturbo), Moloco, Liftoff kreatif stüdyoları.

**İlan avlama yerleri:** gamejobs.co, ingamejob.com, remotive.com, remocate.app, outscal.com, jobgether, LinkedIn, Hitmarker.

---

## 5. İlanların ortak kriter matrisi

Taradığım ~12 ilanda tekrar eden şartlar:

**Zorunlu (neredeyse hepsinde)**
- JavaScript **ve/veya TypeScript** + HTML5 + CSS3 (CSS/JS animasyon dahil)
- En az bir HTML5 oyun framework'ü: **PixiJS** (en sık) / Phaser / Cocos; 3D'de Three.js, Babylon.js, PlayCanvas
- **Portfolyo — açılıp oynanabilir link.** Video capture kabul edilmiyor. ("Portfolio of playable ads (required)")
- 1–3 yıl playable/HTML5 oyun deneyimi (junior 1+, mid 2+, Goodgame 3+, MY.GAMES 6–8)
- Ad network spec bilgisi: AppLovin, Unity Ads, Google Ads, ironSource, Mintegral, Facebook + **MRAID**
- Boyut / FPS / yükleme süresi optimizasyonu; **network reddetme sebeplerini bilmek ve çözmek**
- Git

**Sık istenen**
- Webpack / Vite build otomasyonu, Node.js
- **Spine** animasyon ve asset optimizasyonu
- Çoklu çözünürlük + aspect ratio adaptasyonu
- Unity + C# (3D playable ve marketing minigame üretenlerde)
- Figma / Photoshop, temel UI-UX
- Blender temel 3D

**2026'nın yeni şartı**
- **"AI araçlarını üretim akışına entegre etme deneyimi"** artık ilan metinlerinde açıkça geçiyor. 2025'te mobil oyun reklamverenlerinin %90'ından fazlası kreatif üretiminde AI kullanıyordu; ilanlar "çeyrekte 1 değil, haftada 10 varyant" beklentisini yazıyor.

**Rol adı varyasyonları (arama için):** Playable Ads Developer · Playable Ad Developer · HTML5 Game Developer (Playable Ads) · Creative Technologist · Marketing Developer · Ad Developer · Interactive Creative Developer

---

## 6. İşe alım süreci nasıl işliyor?

Goodgame Studios'un ilanı süreci açıkça yazıyor — sektör şablonu bu:
1. Portfolyo taraması (oynanabilir linkler)
2. **Ücretli case study**, 3 parça:
   - bir referans playable'ın **teardown** analizi
   - verilen asset'lerle küçük bir playable **inşa etmek**
   - build'i **belirli bir network spec'ine paketlemek**
3. Kısa kreatif konsept yazısı

Yani seçilme kriteri "framework listesi" değil, **paketlenmiş çalışan build + neden böyle yaptığını anlatabilmek.**

---

## 7. Para

- **Birim başı (ajans fiyatı):** mraid.io şablon $490 → karmaşık özel $1.990. Genel dış partner aralığı $3.000–8.000 (karmaşıklık, ses/VFX, lokalizasyon, kaç network, QA'ya göre).
- **Süre:** basit playable birkaç iş günü; prototip 3–5 gün, test edilmiş sürüm 7–10 gün; karmaşık 1–3 hafta; ajans turnaround 2–4 hafta.
- **Maaş:** güvenilir kamuya açık veri yok. Arama sonuçlarındaki Avrupa rakamları (£85K–£250K vb.) aggregator tahmini, **gerçek ilan verisi değil** — referans alma. Gerçek sinyal için ilanlarda yazan bantları topla.

---

## 8. Bizim durumumuz — gap analizi

**Elimizde ne var:** 8+ tamamlanmış web oyunu (Carrion, Chainshot, Corrupted Exe, Cyberverse, Pantheon Clash, Swingwreck, Zeno Brawl, Lasthope Survival) — hepsi Phaser 3 + Vite + TS, dist alınmış, bazıları itch/CrazyGames'e çıkmış.

**Bu neyi karşılıyor:** "HTML5 oyun geliştirme deneyimi", oyun hissi, mekanik tasarımı, build alma, yayınlama. İlanların yarısı bunu zaten istiyor.

**Neyi karşılamıyor — kapatılacak açıklar:**
| Açık | Neden önemli | Aksiyon |
|------|--------------|---------|
| Phaser 1.5 MB | 5 MB bütçede kabul edilemez ağırlık | Playable'lar için PixiJS veya saf Canvas'a geç |
| Tek dosya inline pipeline yok | Unity/AppLovin şartı | base64 inline eden kendi build script'imiz (bu proje) |
| MRAID / CTA API entegrasyonu yok | ilanların ortak maddesi | 5 network için wrapper katmanı |
| Portfolyo playable değil, oyun | ilan "playable link" istiyor | 5–6 gerçek playable üret |
| Network paketleme deneyimi yok | case study'nin 3. adımı | her playable'ı 5 formatta çıkar |
| Teardown/analiz yazısı yok | case study'nin 1. adımı | aylık trend teardown'ları yaz |

---

## 9. Önerilen sonraki adım

Bu projeyi **"playable portfolyo + kendi build pipeline'ım"** olarak kurmak, iki açığı birden kapatıyor: hem oynanabilir linkler, hem de ilanlarda geçen "tooling ve otomasyon kurma" maddesi.

Somut kapsam önerisi:
1. **Pipeline** — Vite tabanlı, tek HTML çıktı veren, asset'leri base64 inline eden, MRAID/Meta/Google/Unity/AppLovin wrapper'ı ekleyen build sistemi + boyut bütçesi kontrolü.
2. **5 playable**, farklı mekanik ailesi (2026'da koşan formatlardan seç): merge, match-3 fail-hook, pull-the-pin/puzzle, tower defense, spin-the-wheel/karakter seçimi. Bazıları mevcut oyunlarımızın mekaniğinden türetilebilir.
3. **Her biri 5 network paketinde**, <2 MB hedef, <10 sn time-to-fun.
4. **Teardown yazıları** — Royal Kingdom / Royal Match playable'larını sök, ne yaptıklarını yaz. Bu, mülakat case study'sinin birebir provası.
5. **Vitrin sayfası** — tüm playable'ların QR + link listesi, ölçülen boyut/FPS tablosuyla.

---

## 10. Kaynaklar

- Segwise — [Playable Ads Guide 2026](https://segwise.ai/blog/understanding-playable-ads-guide), [HTML5 Playable Ads Guide](https://segwise.ai/blog/html5-playable-ads-guide), [Playable Ad Generation Tools](https://segwise.ai/blog/playable-ad-generation-tools)
- Matej Lancaric — [Playable Ads UA 101](https://lancaric.me/playable-ads-ua-guide/), [Trends Şubat 2026](https://lancaric.me/playable-ads-trends-in-mobile-games-apps-february-2026/)
- iLogos — [Playable Ads in 2026](https://ilogos.biz/playable-ads-micro-games/)
- AppAgent — [What Are Playable Ads](https://appagent.com/blog/what-are-playable-ads/), [State of Playable Ads 2025](https://appagent.com/blog/the-state-of-playable-ads-in-2025-mid-year-strategic-review/), [Best Creative Agencies 2026](https://appagent.com/blog/the-best-creative-agencies-for-mobile-games-in-2026/)
- Sett — [Mobile Game Advertising 2026](https://www.sett.ai/content/mobile-game-advertising/), [Playable Factory Alternatives](https://www.sett.ai/content/playable-factory-alternatives/)
- Spec'ler — [Unity playable specs](https://docs.unity.com/en-us/grow/acquire/creatives/playable/specifications), [Google Ads playable specs 2026](https://hookin.io/blog/google-ads-playable-ad-specs-and-best-practices-2026), [network boyut limitleri](https://www.playableendcards.com/blog/playable-ad-size-limits-by-network)
- İlanlar — [Goodgame Studios](https://goodgamestudios.teamtailor.com/jobs/8173219-marketing-developer-video-playable-ads), [X-FLOW](https://www.linkedin.com/jobs/view/playable-ads-developer-at-x-flow-4361313215), [ZiMAD](https://www.remocate.app/jobs/playable-ads-developer), [Tripledot/PeopleFun](https://careers.claltech.com/companies/tripledot-studios/jobs/80330024-playable-ads-developer), [Voodoo](https://gamejobs.co/Playable-Ads-Developer-at-Voodoo), [Gameloft](https://gamejobs.co/HTML5-Game-Developer-Playable-Ads-Developer-at-Gameloft), [MY.GAMES](https://outscal.com/job/3d-html5-playable-ads-developer-at-my-games-in-worldwide-1), [Medialicious](https://jobs.ashbyhq.com/medialicious/10d87a0f-a786-4566-ae33-d3193b174f80), [iLogos](https://www.remoterocketship.com/us/company/careers-ilogos-biz/jobs/middle-developer-pixi-js-playable-ads-worldwide-remote/), [Estoty](https://ingamejob.com/en/job/playable-ad-game-developer)
- Türkiye — [Tamatem, Playable Factory'i satın aldı (PocketGamer.biz)](https://www.pocketgamer.biz/tamatem-acquires-ad-tech-firm-playable-factory-in-ai-first-shift/), [Playable Factory](https://playablefactory.com/)
- Araçlar — [smoudjs/playable-sdk (açık kaynak MRAID wrapper)](https://github.com/smoudjs/playable-sdk), [@smoud/playable-scripts](https://www.npmjs.com/package/@smoud/playable-scripts), [GitHub playable-ad topic](https://github.com/topics/playable-ad)
- Wildlife Studios — [Playable ads teknik blog](https://medium.com/tech-at-wildlife-studios/playable-ads-how-we-use-them-to-generate-heavy-buzz-for-our-games-a5ea3651d99)
