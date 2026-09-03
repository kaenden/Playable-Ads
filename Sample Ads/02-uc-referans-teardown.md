# Teardown 02 — Üç referans: Match-3, Toon Blast, Klondike 3D

**Tarih:** 2 Eylül 2026
**Kaynaklar:** `Kayıt 2026-09-02 110821.mp4` (31.9 sn), `111127.mp4` (109.5 sn),
`112814.mp4` (15.2 sn). Kareler `frames/` altında değil, ham videolar klasörde.

---

## A. Match-3 — fenerci karakter (31.9 sn)

Tam boyalı illüstrasyon: sisli sokak, fenerli yaşlı adam, atmosferik ışık.

| Öğe | Ne yapıyor |
|-----|-----------|
| **Hook** | Konuşma balonu: *"I BET YOU CAN'T WIN IN 4 TURNS!"* — hedef değil, **meydan okuma** |
| Bütçe | Geri sayım barı yok, **4 hamle hakkı**. 4 → 3 → 2 → 1 → 0 |
| Board | Zengin taş çeşitliliği: renkli mücevherler, buz/kilit kareler, özel taşlar |
| Kapanış | Karakter tekrar: *"NOT A SIMPLE MATCH-3 GAME, HUH?"* |
| **CTA** | **İki buton: PLAY NOW + TRY AGAIN** |
| Diğer | Sağ üstte ses toggle |

**Öne çıkan:** Hamle bütçesi geri sayımdan daha okunur ve kaybı "senin kararın"
yapıyor. Ve kapanışta tek CTA yok — TRY AGAIN oyuncuyu tutuyor, ikinci bir CTA
gösterimi kazandırıyor.

---

## B. Klondike — "Farm Adventure Demo" (109.5 sn)

3D izometrik idle-arcade. Pencere başlığı `Farm Adventure Demo`, sol üstte
KLONDIKE logosu ve hemen altında **PLAY NOW** butonu.

| Öğe | Ne yapıyor |
|-----|-----------|
| Mekanik | Karakteri sürükle → domates topla → kasaya bırak → para kazan → alan aç |
| Döngü | Idle-arcade toplama; sayaç 0 → 20 → 50 → 120 → 190 |
| **Süre** | **109 saniye, end card YOK** — sonsuz döngü |
| CTA | Sol üstte sabit, hiç kaybolmuyor, oyunu hiç kesmiyor |
| Diğer | Sol altta ses toggle, sağ üstte X kapatma |

**Sanat:** düz gölgeli (flat-shaded) **low-poly**. Texture yok denecek kadar az —
düz yeşil zemin, kahverengi çit, tek renk arabalar, kırmızı domates blob'ları.
Ama ortada bir **dünya** var: çit, yol, park etmiş arabalar, binalar, koşan
karakter.

---

## C. Toon Blast (Peak Games) — (15.2 sn)

| Öğe | Ne yapıyor |
|-----|-----------|
| Hook | *"Tap the Tiles!"* + parlayan el işareti, ilk karede |
| HUD | Sol üstte karakter portresi, **Goal** çipleri (10/10), **Move** yerine `0:59` sayaç |
| Board | 3D render edilmiş bloklar: bevel, gradient, ikon; bomba/roket kombinaları |
| İlerleme | Header altında yıldızlı progress bar |
| **Ödül anı** | *"Level Completed!"* + kutlayan karakter illüstrasyonu — **ayrı bir sahne** |
| Kapanış | Ardından **logo kartı** (TOON BLAST!) + PLAY! butonu |
| Diğer | Sağ üstte X, altta sabit kırmızı çerçeveli yeşil PLAY! |

**Öne çıkan:** Kutlama ile CTA **ayrılmış**. Önce "kazandın" duygusu tek başına
yaşatılıyor, sonra marka + buton geliyor. Bizde ikisi tek ekranda ezik.

---

## Üçünün ortak dili

1. **Karakter var.** Fenerci, çiftçi, ayı maskotu. Üçünde de ekranda bir "kim".
2. **Marka var.** KLONDIKE ve TOON BLAST logoları; reklam belirli bir oyunu satıyor.
3. **Dünya var.** Grid'in arkasında bir sahne: sokak, çiftlik, karlı manzara.
4. **CTA hiç kaybolmuyor** ve oyunu hiç kesmiyor.
5. **Ses toggle'ı var** (üçünde de), **X kapatma** (mobil olan ikisinde).

## Üçünün ayrıldığı yer

| | Süre baskısı | Kapanış |
|---|---|---|
| Match-3 | 4 hamle | Karakter + PLAY NOW / TRY AGAIN |
| Klondike | yok | yok — sonsuz döngü |
| Toon Blast | 0:59 sayaç | Level Completed → logo kartı → PLAY! |

Yani "doğru" tek bir kapanış yok. Ama **hiçbiri bizim yaptığımız gibi kutlamayı
ve CTA'yı tek karede ezmemiş.**

---

## Bizim playable'a somut aksiyonlar

| Gözlem | Aksiyon | Maliyet |
|--------|---------|---------|
| Meydan okuyan karakter hook'u | "WAKE THE DRAGON" hedef; bir karakter ve replik ekle | orta |
| Hamle bütçesi > geri sayım | 22 sn timer yerine/yanında "4 merge hakkın var" | düşük |
| Kutlama ile CTA ayrı sahne | End card'ı ikiye böl: önce ödül, sonra logo + buton | düşük |
| İkinci CTA: TRY AGAIN | End card'a replay butonu koy | düşük |
| Ses toggle | Ses ekle + toggle (etkileşim sonrası) | orta |
| ~~X kapatma~~ | **YAPMA.** Karelere yakından bakınca × creative'in içinde değil: Toon Blast'ta beyaz kartın dışında, arka planda; Klondike'da pencere çubuğunda. İkisi de **container'ın** çizdiği buton. Kendi X'imizi koymak çift kapatma butonu demek | — |
| Grid değil dünya | Arka planda bir sahne kur | **yüksek** |
| Marka | Sahte bir logo/IP kimliği tasarla | orta |
