# Şablon

Mobil uygulama serisinin ortak iskeleti. Yeni uygulamalar sıfırdan kurulmaz —
üst klasördeki `/yeni-uygulama` komutuyla buradan türetilir.

## Ne içerir

- **Tasarım sistemi** (`src/ui/`) — token'lar, tipografi, hareket, 13 bileşen
- **Duyarlı yerleşim** (`src/ui/useScreen.ts`) — boyut sınıfları, içerik genişliği sınırı,
  `scale()` ve `hero`; `Screen` tablette içeriği ortalar
- **Tema** — aydınlık/koyu/sistem, kullanıcı tercihi kalıcı
- **Yerel veri** (`src/db/`) — SQLite, ileri yönlü migration, dışa aktarma ve tam silme
- **Bildirim** (`src/lib/notifications.ts`) — günlük yerel hatırlatma, Android 13+ izin akışı dahil
- **Zorunlu ekranlar** — onboarding, ayarlar, hakkında, gizlilik
- **Bileşen vitrini** (`/vitrin`) — tasarım sisteminin tamamı tek ekranda
- **Test koşucusu** (`scripts/check.ts`) — çerçevesiz, `src/lib` aritmetiği için
- **Yayın altyapısı** — `app.config.ts`, `eas.json`, `docs/gizlilik.md`, `store/`

## Çalıştırma

```bash
npm install
npx expo start          # Expo Go veya development build ile aç
```

## Kontroller

```bash
npm test                # src/lib içindeki saf mantık
npm run typecheck       # tsc --noEmit — commit öncesi temiz olmalı
npm run doctor          # expo-doctor
```

## Derleme

```bash
npx eas build --profile preview    --platform android   # cihaza kurulabilir APK
npx eas build --profile production --platform android   # Play Store için AAB
```

Ayrıntı için üst klasördeki `play-store-yayin` skill'ine bak.

## İlkeler

Sunucu yok, hesap yok, reklam yok, takip yok. Her şey cihazda.
Ortak kurallar üst klasördeki `CLAUDE.md` dosyasında.
