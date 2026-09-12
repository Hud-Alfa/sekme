import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { tr } from '@/i18n/tr';
import { Button, Card, Screen, space, Text } from '@/ui';

/**
 * Play Store requires a privacy policy URL as well as this in-app copy. The
 * same text lives in `docs/gizlilik.md`, which is what gets published.
 * Keep the two in sync — a policy that does not match the app is a rejection.
 */
export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <View style={{ gap: space.xl }}>
        <Text variant="title">{tr.privacy.title}</Text>

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">Hangi verileri topluyoruz?</Text>
            <Text variant="body" color="textMuted">
              Hiçbirini. Bu uygulamanın sunucusu yok. Girdiğin her şey yalnızca telefonunun
              içindeki yerel veritabanında durur ve cihazından hiçbir yere gönderilmez.
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">Üçüncü taraflar</Text>
            <Text variant="body" color="textMuted">
              Uygulamada reklam ağı, analitik aracı veya çökme raporlama servisi bulunmuyor.
              Hiçbir üçüncü tarafa veri aktarılmıyor.
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">Verilerini silmek</Text>
            <Text variant="body" color="textMuted">
              Ayarlar ekranındaki “Tüm verimi sil” seçeneği her şeyi kalıcı olarak siler.
              Uygulamayı telefonundan kaldırman da aynı sonucu verir.
            </Text>
          </View>
        </Card>

        <Button label={tr.common.back} variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
