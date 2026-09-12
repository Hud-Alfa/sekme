# Play Store Mağaza Metni — Şablon

> Bu dosya `/store-metin` komutuyla her uygulama için yeniden üretilir.
> Buradaki hiçbir ifade uygulamada olmayan bir özelliği anlatmamalıdır.

## Uygulama adı (en fazla 30 karakter)

```
Şablon
```

## Kısa açıklama (en fazla 80 karakter)

```
Seri için ortak iskelet. Gerçek uygulamalarda bu satır baştan yazılır.
```

## Tam açıklama (en fazla 4000 karakter)

```
Bu bir şablondur, mağazaya çıkmaz.

Gerçek uygulamada bu bölümün yapısı şöyledir:
- ilk üç satır tek başına ikna eder
- ne işe yaradığı
- kimin için olduğu
- ne yapabileceğin (maddeler)
- gizlilik vaadi: veriler cihazda kalır, hesap yok, reklam yok
- kapanış
```

## Anahtar kelimeler

Açıklamaya doğal biçimde yedirilecek Türkçe arama terimleri buraya listelenir.

## Sürüm notu (en fazla 500 karakter)

```
İlk sürüm.
```

## Görsel kontrol listesi

- [ ] `assets/images/icon.png` — 512×512 veya üzeri, şeffaflık yok
- [ ] `store/feature-graphic.png` — 1024×500
- [ ] `store/screenshot-1.png` … en az 2 adet, 1080×1920
- [ ] Tüm görsellerdeki metin Türkçe ve yazım hatasız
