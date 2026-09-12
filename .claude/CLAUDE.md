# Sekme — uygulama bağlamı

> Kod adı **Sekme**; mağaza adı değişebilir. Değiştirirken `../DURUM.md` içindeki
> 7 maddelik listeyi uygula.

Ortak kurallar üst klasördeki `CLAUDE.md` içinde. Burada yalnız bu oyuna özgü olanlar var.

## Tasarım felsefesi

1. **Akış.** Kontroller pürüzsüz, fizik tutarlı. Oyuncu ekrana dokunduğu an akışa girer.
2. **Reklamsızlık.** Türün geri kalanındaki "her ölümde video" yok. Kesintisiz oyun.
3. **Kozmetik motivasyon.** İlerleme oyunu kolaylaştırmakla değil, görsel tatminle gelir.
   Bütün toplar **aynı** oynar; değişen yalnız görünüş.
4. **60 FPS pazarlık konusu değil.**

## Çekirdek döngü

Bölüm, aşama, menü yok. Tek sonsuz akış:

1. Oyuncu sürükleyerek nişan alır; ilk temasa kadar kesik bir çizgi görünür
2. Bırakınca toplar aynı noktadan peş peşe çıkar. Yerçekimi yok, hız sabit
3. Toplar bloklardan ve duvarlardan seker; blok sayısı her değmede 1 azalır, sıfırda patlar
4. `+1` ve altın eşyaları topa değince toplanır — **eşyalar topu saptırmaz**
5. Bütün toplar tabana dönünce tur biter, tahta bir sıra iner, üstte yeni sıra doğar
6. Bir blok en alt çizgiye değerse oyun biter

Ekranda **seviye/bölüm gösterilmez.** Tek sayaç **skor** ve o da tur sayısıdır.

## Pazarlık konusu olmayan teknik kurallar

**Fizik JS iş parçacığında çalışmaz.** Konum, çarpışma ve yansıma tamamen
`useFrameCallback` içinde, UI iş parçacığında döner. React tur bitene kadar hiçbir şey
öğrenmez; tek `runOnJS` sonucu karşıya geçirir. Kırk top uçarken kare başına JS'e
uğramak, oyunla slayt gösterisi arasındaki farktır.

**Tüm top durumu tek bir shared value'da**, düz diziler hâlinde. Top başına shared value
demek hook'u döngüde çağırmak demekti; diziler ayrıca frame callback'in köprüyü hiç
geçmeden bütün toplara dokunmasını sağlıyor.

**Çekirdek saf ve testli.** `src/game/` içinde React, SQLite ve animasyon yok.
Rastgelelik enjekte edilir; `npm test` bir tohumdan tüm oyunu tekrar oynar.

**İki fizik ayrıntısı kritik:**
- Sekme ekseni, topun gidiş yönünden değil **örtüşme derinliğinden** çıkar. Köşede yönle
  karar vermek, topu iki blok arasındaki dikişten geçirir.
- Hareket kare süresine göre değil **mesafeye göre** alt adımlara bölünür. Böylece hızlı
  top tünellemez ve davranış 60 Hz ile 120 Hz'de aynı olur.

**Sıkışma koruması** (`curve.ts` → `STUCK`): 10 sn sonra sekme açısına jitter, 12 sn sonra
hız iki katı, 15 sn sonra tabana çekilir. Özellik değil zorunluluk — yatay sıkışan bir top
turu hiç bitirmez.

## Denge

Bütün denge sayıları **yalnız `src/game/curve.ts` içinde.** Zorluğu değiştirmek kod
değişikliği değil sayı değişikliğidir — Blok Patlat'taki `scoring.ts` ayrımının aynısı.
Eğrinin geri gitmediğini ve tek turda dörtten fazla sıçramadığını `npm test` doğruluyor.

## Ekonomi ve kapsül

**Altın yalnızca oynayarak kazanılır. Satın alınamaz ve alınamayacak** — bu seride Play
Billing yok. Bu, cimri olmanın olağan sebebini ortadan kaldırıyor; o yüzden garanti
(pity) kuralları bilerek cömert: şanssızlık sabra mal olur, paraya asla.

- Yumuşak garanti: 10 kapsülde bir Destansı veya üzeri
- Sert garanti: 50 kapsülde bir Efsanevi veya üzeri
- Kopya çıkarsa nadirliğe göre altın iadesi

**Oranlar kapsül ekranında yazılı.** Play bu şekildeki her sistem için oran açıklaması
istiyor, ve oranını saklayan bir makinenin saklayacak bir şeyi vardır.

> ⚠️ Yeni bir top eklenirken **oyunu etkileyen** bir özellik verme. Toplar yalnız
> görünüm. Bu kural bir kere bozulursa koleksiyon "ödeme yapan kazanır"a döner —
> burada ödeme olmasa bile oynamayan kaybeder demektir.

## Kalıcılık

Her turdan sonra oyun kaydedilir; telefon çalarsa hiçbir şey kaybolmaz. **Bitmiş oyun
kaydedilmez**, silinir: ölü bir tahtaya açılmak mümkün olabilecek en kötü ilk ekran
(Blok Patlat'ta öğrenildi).

## Mimari

```
src/game/curve.ts    bütün denge sayıları — tek ayar noktası
src/game/physics.ts  saf çarpışma/yansıma; her fonksiyon 'worklet'
src/game/board.ts    hücreler, satır doğuşu, iniş, hasar
src/game/balls.ts    top kataloğu ve nadirlikler
src/game/gacha.ts    kapsül, garanti sayaçları, kopya iadesi
src/game/engine.ts   (state, action) => state; tur seviyesi
src/components/GameBoard.tsx  UI thread fizik döngüsü
src/store/game.ts    kalıcılık ve sıralama. Kural kararı VERMEZ
```

## Doğrulama

```bash
npm test && npm run typecheck && npm run doctor
```

Fiziğin *hissi* testle doğrulanamaz; cihazda bakılacaklar README'de.
