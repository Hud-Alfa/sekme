# Play Console → Uygulama içeriği — Sekme

> Play Console'daki **Uygulama içeriği** bölümünün her sorusuna verilecek cevap.
>
> Paket adı: `com.ozdas.sekme` · Kategori: Oyunlar → Aksiyon
> Son güncelleme: 12 Eylül 2026

## 1. Data Safety (Veri güvenliği)

### Ana soru

> *Uygulamanız gerekli kullanıcı verisi türlerinden herhangi birini topluyor mu veya
> paylaşıyor mu?*

**Hayır.** Sunucu yok, ağ trafiği yok; Google'ın tanımında "toplama" verinin cihazdan
dışarı aktarılmasıdır.

### Cihazda ne duruyor

- Rekor ve biten oyunların skor listesi
- Biriken altın, açılan toplar, garanti (pity) sayaçları
- Devam eden oyunun tahtası

Hiçbiri gönderilmiyor, yedeklenmiyor.

### Reklam kimliği

**Kullanılmıyor.** `AD_ID` manifest'te yok; reklam, analitik veya çökme raporlama SDK'sı
bulunmuyor.

### İzinler

Tek çalışma zamanı izni **`POST_NOTIFICATIONS`**. Konum, mikrofon, depolama ve "diğer
uygulamaların üzerine çizme" `blockedPermissions` ile manifest'ten çıkarılıyor.

### Verinin silinmesi

Hesap yok. **Ayarlar → Tüm verimi sil** her şeyi kalıcı siler.

## 2. Kapsül sistemi — bu oyunun özel konusu

Oyunda rastgele ödül veren bir kapsül (gacha) sistemi var. Play'in bu konuda net
kuralları var ve üçünü de karşılıyoruz:

**a) Oranlar açıklanmalı.** Çıkma oranları **oyunun içinde**, kapsül ekranının üstünde,
nadirlik başına yüzdeyle yazılı. Garanti (pity) kuralları da aynı yerde yazılı.

**b) Gerçek para yok.** Altın **yalnızca oynayarak** kazanılır. Uygulama içi satın alma
yok, Play Billing entegrasyonu yok, gerçek parayla altın alınamaz. Bu, sistemi Play'in
"ödeme karşılığı rastgele öğe" kapsamının dışında bırakıyor ama oran açıklaması yine de
yapılıyor — kural olduğu için değil, doğrusu olduğu için.

**c) Kumar değil.** Ne gerçek para girişi ne de gerçek değer çıkışı var; kazanılan şey
oyun içi görünümden ibaret. İçerik derecelendirme anketinde:

- "Gerçek parayla kumar" → **Hayır**
- "Simüle edilmiş kumar" → **Hayır** (kart/slot/bahis teması yok, para yatırma yok)
- "Rastgele öğe içeren satın alma" → **Hayır** (satın alma yok)

Anket bu soruları farklı sözcüklerle sorabilir; ölçüt değişmez: **para girmiyor, değer
çıkmıyor.**

> ⚠️ Bu cevaplar, kapsülün gerçek parayla alınamamasına dayanıyor. Bir gün satın alma
> eklenirse bu bölümün tamamı ve derecelendirme baştan yapılmalıdır.

## 3. Formun geri kalanı

| Soru | Cevap |
|---|---|
| Gizlilik politikası URL'i | `<taban>/sekme/gizlilik.html` |
| Uygulama erişimi | Tüm işlevler giriş yapmadan kullanılabilir |
| Reklam içeriyor mu | **Hayır** |
| Uygulama içi satın alma | **Yok** |
| Kullanıcılar etkileşime giriyor mu | **Hayır** — çevrimiçi sıralama, sohbet, paylaşım yok |
| Haber / devlet / finans / COVID-19 | Hayır |

### İçerik derecelendirmesi

Şiddet yok, korku yok, cinsellik yok, madde göndermesi yok, kumar yok. Soyut şekiller ve
sayılar. En düşük derece beklenir.

### Hedef kitle

**13 ve üzeri.** Oyun çocuklara zararsız ama çocuk kitleye *yönelik* tasarlanmadı; 13
altı işaretlenirse Families politikası ve ek tasarım şartları devreye girer.

## 4. Doldurmadan önce son kontrol

- [ ] Gizlilik politikası URL'i açılıyor
- [ ] Kapsül ekranındaki oran tablosu hâlâ gerçek oranları gösteriyor
      (`src/game/balls.ts` → `RARITY_ODDS`)
- [ ] Hâlâ hiçbir reklam/analitik paketi yok
- [ ] Ekran görüntüleri gerçekten oynanan tahtadan
