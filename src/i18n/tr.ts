/**
 * Every user-facing string lives here — never inline in a screen.
 *
 * UI language is Turkish; code and comments stay English. Keeping the copy in
 * one file makes tone consistent and makes the Play Store listing easy to keep
 * honest, since it can be written from what the app actually says.
 */
export const tr = {
  app: {
    name: 'Sekme',
    tagline: 'Seken toplar, inen bloklar',
  },

  game: {
    score: 'Skor',
    best: 'Rekor',
    balls: 'Top',
    gold: 'Altın',
    aimHint: 'Parmağını sürükle, bırak — toplar gitsin',
    resume: 'Devam et',
    newGame: 'Yeni oyun',
    over: 'Oyun bitti',
    overBody: 'Bloklar en alta ulaştı.',
    newRecord: 'Yeni rekor!',
    goldEarned: 'Bu turda kazandığın altın',
    again: 'Tekrar oyna',
  },

  capsule: {
    title: 'Kapsül',
    collection: 'Koleksiyon',
    open: 'Kapsül aç',
    cost: '{cost} altın',
    notEnough: 'Yeterli altının yok',
    owned: '{owned} / {total} top',
    duplicate: 'Zaten sende — {refund} altın geri verildi',
    isNew: 'Yeni!',
    select: 'Bunu kullan',
    selected: 'Kullanılıyor',
    locked: 'Kilitli',
    rarity: {
      yaygin: 'Yaygın',
      nadir: 'Nadir',
      destansi: 'Destansı',
      efsanevi: 'Efsanevi',
      mistik: 'Mistik',
    },
    odds: 'Çıkma oranları',
    oddsBody:
      'Kapsül ücretsizdir: altın yalnızca oynayarak kazanılır, satın alınamaz. ' +
      'Toplar yalnız görünüm değiştirir — hiçbiri oyunu kolaylaştırmaz.',
    pity: 'Garanti',
    pityBody:
      '{soft} kapsülde bir Destansı veya üzeri, {hard} kapsülde bir Efsanevi veya üzeri garanti.',
  },

  common: {
    save: 'Kaydet',
    cancel: 'Vazgeç',
    delete: 'Sil',
    close: 'Kapat',
    back: 'Geri',
    continue: 'Devam',
    done: 'Tamam',
    skip: 'Atla',
    start: 'Başla',
    retry: 'Tekrar dene',
    loading: 'Yükleniyor…',
    error: 'Bir şeyler ters gitti',
  },

  onboarding: {
    steps: [
      {
        title: 'Sürükle, bırak, sek',
        body:
          'Toplar duvarlardan ve bloklardan seker. Her blokta kaç kez değmesi ' +
          'gerektiği yazar; sıfırlanınca patlar.',
      },
      {
        title: 'Bölüm yok, reklam yok',
        body:
          'Tek bir sonsuz akış. Ölünce izlemen gereken video yok, beklemen ' +
          'gereken can yok. Topladığın altınla yeni toplar açarsın.',
      },
      {
        title: 'İstediğinde silersin',
        body: 'Ayarlar’dan tüm verini dışa aktarabilir ya da tek dokunuşla silebilirsin.',
      },
    ],
  },

  settings: {
    title: 'Ayarlar',
    appearance: 'Görünüm',
    theme: 'Tema',
    themeSystem: 'Sistem',
    themeLight: 'Aydınlık',
    themeDark: 'Koyu',

    feedback: 'Geri bildirim',
    haptics: 'Titreşim',
    hapticsHint: 'Dokunma ve başarı anlarında hafif titreşim',

    notifications: 'Bildirimler',
    reminder: 'Günlük hatırlatma',
    reminderTime: 'Hatırlatma saati',
    notificationsDenied: 'Bildirim izni verilmedi. Telefon ayarlarından açabilirsin.',

    data: 'Verilerim',
    exportData: 'Verimi dışa aktar',
    exportHint: 'Tüm verini bir dosya olarak paylaş',
    deleteData: 'Tüm verimi sil',
    deleteHint: 'Bu işlem geri alınamaz',
    deleteConfirmTitle: 'Tüm verin silinsin mi?',
    deleteConfirmBody:
      'Bu işlem geri alınamaz. Uygulamadaki her şey kalıcı olarak silinecek ve baştan başlayacaksın.',
    deleteConfirmAction: 'Evet, hepsini sil',

    about: 'Hakkında',
    privacy: 'Gizlilik',
    version: 'Sürüm',
  },

  privacy: {
    title: 'Gizlilik',
  },

  about: {
    title: 'Hakkında',
  },
} as const;
