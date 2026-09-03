# Teardown 01 — State.io (Casual Azur Games) / Mintegral

**Kaynak:** `WhatsApp Video 2026-09-01 at 17.44.47.mp4` (52.6 sn, 392×850, 60fps)
**Kareler:** [frames/intro_01.png](frames/intro_01.png) (ilk 4 sn), [frames/sheet_01–03.png](frames/) (tam akış)
**Reklamveren:** Casual Azur Games — *State.io — Dünyayı Fethet*
**Ağ:** Mintegral (sol altta watermark)
**Format:** Endless playable, end card YOK

---

## Akış

| t | Ne oluyor |
|---|-----------|
| **0.0 sn** | Oyun **zaten çalışıyor**. Skor 18-16. Tutorial eli oyuncunun üssünde. Intro yok, logo yok, "tap to start" yok. |
| 0.0–2.0 | El, üsten komşu nötr bölgeye sürüklüyor; ok çiziliyor, bölge maviye dönüyor |
| 2–45 | Oyuncu haritayı fethediyor, Bob (AI) kırmızıyla büyüyor, skorlar yarışıyor |
| ~25, ~40, ~48 | INSTALL NOW'a basılıyor → Google Play overlay açılıyor → kapatılıp **oyuna geri dönülüyor** |
| 52.6 | Video bitiyor. Oyun hâlâ devam ediyor, kazanma/kaybetme ekranı hiç gelmedi |

---

## Mekanik

- Kare/bölge haritası, her bölgede asker sayısı (nötrler hep `10`)
- Üsler sayacı otomatik artırıyor; altlarındaki yeşil bar üretim çarpanı (`x2`, `x3`)
- Kendi bölgenden komşuya **sürükle** → ok çizilir, asker gider, sayı büyükse bölge senin olur
- Ortadaki gri "boss" üs `x3` çarpanlı ve menzil çemberi çizili — haritanın ödül merkezi
- Bob (AI) sen hiçbir şey yapmasan da büyümeye devam ediyor

---

## Çalınacak olanlar

**1. Time-to-fun = 0.** Sektör "10 sn altında" diyor; bu reklam **0 sn**'de oynanıyor. Açılışta simülasyon çoktan koşuyor ve el ilk hamleyi gösteriyor. Bizim playable'da ipucu 2.2 sn boşta kaldıktan sonra çıkıyordu — bunu ilk kareye çektim.

**2. Baskı kaynağı geri sayım değil, rakip.** Üstteki `1 You / 2 Bob` skor tablosu sürekli güncelleniyor. Süre baskısı seansı bitirir; rakip baskısı seansı **uzatır**. Bizim 22 sn'lik timer bir "fail-hook" veriyor ama oturumu kesiyor.

**3. Kullanıcı hiçbir şey yapmasa bile durum kötüleşiyor.** Bob büyümeye devam ediyor. Boş ekran yok, ölü an yok.

**4. Sanat neredeyse yok.** Düz gri harita, renkli poligonlar, daireler ve rakamlar. Tek bir detaylı illüstrasyon yok — ve top-grossing bir hyper-casual oyunun ana kreatifi bu. **Vektör/prosedürel art'ın yeterli olduğunun kanıtı**, bizim 14 KB'lık yaklaşımı doğruluyor.

**5. CTA hiç kaybolmuyor ama hiç zorlamıyor.** Alt ortada sabit yeşil buton. Store overlay'i kapatınca oyun kaldığı yerden devam ediyor — kullanıcı cezalandırılmıyor, tekrar tekrar tıklama şansı kalıyor.

---

## Çalınmayacak olanlar

- **End card yok.** Ödül anı yok, "kazandın" duygusu yok. Endless format Şubat 2026 trendlerinde geçiyor ama bu bir tercih: seansı uzatıyor, tatmini feda ediyor. Portfolyoda ikisini de gösterebilmek daha iyi.
- **Rakamlar okunmayı gerektiriyor.** 10 vs 19 karşılaştırması bilişsel yük. Casual kitlede işe yarıyor ama "tek bakışta anlaşılır" değil.
- **Gri harita duygusuz.** İşlevsel, ama marka hissi sıfır. IP'si olan bir oyunda bu yaklaşım işe yaramaz.

---

## Bizim playable'a etkisi

| Gözlem | Aksiyon | Durum |
|--------|---------|-------|
| Time-to-fun 0 sn | Tutorial elini ilk kareden göster | ✅ yapıldı |
| Sanat vektör yeterli | Prosedürel art'ta kal, kaliteyi yükselt | ✅ art pass |
| Rakip baskısı > geri sayım | Alternatif varyant olarak dene (A/B) | ⏳ not edildi |
| CTA store'dan dönünce oyun devam | Bizde end card sonrası dokunuş CTA'ya gidiyor, benzer | ✅ |
