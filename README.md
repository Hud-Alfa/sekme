# Sekme

Sonsuz top–blok oyunu. Sürükle, bırak, toplar seksin; bloklardaki sayı sıfırlanınca
patlasın. Bölüm yok, can yok, reklam yok.

Kod adı **Sekme**. Mağaza adı değişebilir.

## Ne var

- Tek sonsuz akış, tek sayaç: **skor** (kaç tur dayandığın)
- Blok sayıları ilerlemeye bağlı bir eğriden doğar; her tur biraz daha sert
- Oynarken toplanan altınla **kapsül** açılır, yeni toplar çıkar
- **Toplar yalnız görünüm değiştirir** — hiçbiri oyunu kolaylaştırmaz
- Altın satın alınamaz, yalnız oynayarak kazanılır. Play Billing yok

## Çalıştırma

```bash
npm install
npx expo start
```

## Kontroller

```bash
npm test                # src/game içindeki saf mantık + fizik matematiği
npm run typecheck
npm run doctor
npm run gorseller
```

## Cihazda elle doğrulama

Fiziğin *hissi* testle doğrulanamaz. Gerçek telefonda bakılacaklar:

- [ ] **Akıcılık**: 40+ top ekrandayken kare düşüyor mu? Bu oyunun tek gerçek sınavı
- [ ] Nişan çizgisi parmağı takip ediyor, bırakınca toplar akış hâlinde çıkıyor
- [ ] Top iki blok arasındaki dikişten geçmiyor (tünelleme)
- [ ] Yatay sıkışan top: 10 sn'de açı bozuluyor, 12'de hızlanıyor, 15'te dönüyor
- [ ] `+1` ve altın eşyaları topu saptırmıyor, sadece toplanıyor
- [ ] Blok kırılınca titreşim var, her sekmede yok (telefon zilleme)
- [ ] Oyun ortasında uygulamayı kapat-aç: kaldığın yerden devam
- [ ] Oyun bitince tekrar açıldığında ölü tahta gelmiyor
- [ ] Kapsül açılışı, kopya iadesi, koleksiyondan top seçme
- [ ] Top uçmazken pil tüketimi: oyun açık dururken telefon ısınmamalı
- [ ] Tur ortasında ana ekrana çık-dön: oyun kaldığı yerden, sıkışma sayaçları tetiklenmeden
- [ ] Aydınlık ve koyu tema
- [ ] Küçük (5") ve büyük (6.7") ekranda tahta sığıyor

## Yapı

Ayrıntı ve gerekçeler `.claude/CLAUDE.md` içinde.

```
src/game/curve.ts    bütün denge sayıları — tek ayar noktası
src/game/physics.ts  saf çarpışma/yansıma, hepsi 'worklet'
src/game/board.ts    hücreler, satır doğuşu, iniş, hasar
src/game/gacha.ts    kapsül, garanti, kopya iadesi
src/game/engine.ts   (state, action) => state
src/components/GameBoard.tsx  UI thread fizik döngüsü
```

Mağaza metinleri `store/metin.md`, gizlilik politikası `docs/gizlilik.md`. Bu dosya aynı
zamanda yayınlanan gizlilik sayfasının **kaynağıdır**: `site` deposundaki `npm run uret`
onu okuyup HTML'e çevirir.
