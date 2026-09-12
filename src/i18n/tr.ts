/**
 * Every user-facing string lives here — never inline in a screen.
 *
 * UI language is Turkish; code and comments stay English. Keeping the copy in
 * one file makes tone consistent and makes the Play Store listing easy to keep
 * honest, since it can be written from what the app actually says.
 */
export const tr = {
  app: {
    name: 'Şablon',
    tagline: 'Seri için ortak iskelet',
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
        title: 'Her şey cihazında',
        body: 'Hesap yok, sunucu yok, reklam yok. Verilerin telefonundan çıkmıyor.',
      },
      {
        title: 'Çevrimdışı çalışır',
        body: 'İnternet olmadan da açılır. Uçakta, metroda, dağ başında fark etmez.',
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
