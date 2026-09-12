# Şablon — uygulama bağlamı

Bu repo bir ürün değil, **diğer uygulamaların türediği iskelet**.
Ortak kurallar üst klasördeki `CLAUDE.md` içinde; burada yalnız bu repoya özgü olanlar var.

## Buraya ne girer, ne girmez

**Girer:** serideki *her* uygulamada işine yarayacak şeyler — tasarım sistemi bileşeni,
tema, veri katmanı, bildirim altyapısı, zorunlu ekranlar, yayın yapılandırması.

**Girmez:** tek bir uygulamaya özgü alan mantığı, alan tabloları, alan ekranları.
Bir şeyin şablona mı yoksa uygulamaya mı ait olduğundan emin değilsen uygulamada tut;
ikinci uygulamada da gerekirse o zaman buraya taşı.

## Dosya haritası

| Yol | İşi |
|---|---|
| `src/ui/` | Tasarım sistemi. `index.ts` dışa açılan tek kapı — ekranlar tek tek dosyalardan import etmez |
| `src/ui/tokens.ts` | `ACCENT` burada. Türetilen her uygulama **yalnız bunu** değiştirir |
| `src/db/index.ts` | SQLite bağlantısı, ileri yönlü migration, `wipeDatabase`, `exportDatabase` |
| `src/lib/notifications.ts` | Günlük yerel hatırlatma; izin reddedilirse `false` döner, çağıran ayar anahtarını yalan söyletmez |
| `src/store/settings.ts` | Kalıcı kullanıcı tercihleri (zustand + `expo-sqlite/kv-store`) |
| `src/i18n/tr.ts` | Kullanıcıya görünen **tüm** metin |
| `src/app/vitrin.tsx` | Bileşen vitrini — türetilirken **silinir** |

## Bu repoda dikkat

- `src/db/index.ts` içindeki `migrations` dizisi **append-only**. Yayınlanmış bir migration
  düzenlenmez veya yeri değiştirilmez; yenisi eklenir.
- `expo-file-system` SDK 54+ API'sini kullanıyor (`File`, `Paths`) — eski
  `cacheDirectory`/`writeAsStringAsync` çağrıları artık yok.
- `app.config.ts` içindeki `blockedPermissions` listesi bilerek uzun: kullanılmayan izin
  Play Store incelemesinde yük, Data Safety formunda da tutarsızlık yaratır.
- Yeni bileşen yazmadan önce `src/ui/index.ts` listesine bak.

## Doğrulama

```bash
npm run typecheck && npm run doctor
npx expo start          # /vitrin ekranını aç, aydınlık ve koyu temada gözden geçir
```

## Öğrenilmiş tuzaklar

- **Font import'u**: `@expo-google-fonts/<aile>` kök yolundan import etmek 16 ağırlığın ve
  italiklerin **hepsini** pakete sokar (~2 MB). Her zaman ağırlık alt yolundan import et:
  `@expo-google-fonts/nunito/700Bold`. `useFonts` ise `expo-font`'tan gelir.
- **Test sınırı**: `scripts/check.ts` yalnız `src/lib` içindeki saf aritmetiği kontrol eder.
  React, SQLite veya cihaz gerektiren hiçbir şey buraya girmez — onlar README'deki elle
  doğrulama listesine yazılır.
- **Duyarlı yerleşim**: ekrana sığması gereken hiçbir sayı sabit yazılmaz. `useScreen()`
  (`src/ui/useScreen.ts`) boyut sınıfı, içerik genişliği, `scale()` ve `hero` verir.
  `Screen` bileşeni tablette içeriği ortalayıp `maxWidth` uygular. Kurallar ve cihaz test
  matrisi üst klasördeki `duyarli-tasarim` skill'inde.
