import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { tr } from '@/i18n/tr';
import { Button, Card, Screen, space, Text } from '@/ui';

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      <View style={{ gap: space.xl }}>
        <Text variant="title">{tr.about.title}</Text>

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">{tr.app.name}</Text>
            <Text variant="body" color="textMuted">
              {tr.app.tagline}
            </Text>
            <Text variant="caption" color="textMuted">
              {tr.settings.version} {version}
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: space.sm }}>
            <Text variant="heading">Söz verdiklerimiz</Text>
            <Text variant="body" color="textMuted">
              • Hesap açmanı istemiyoruz{'\n'}• Verilerini toplamıyoruz{'\n'}• Reklam
              göstermiyoruz{'\n'}• İnternet olmadan da çalışıyoruz
            </Text>
          </View>
        </Card>

        <Button label={tr.common.back} variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
