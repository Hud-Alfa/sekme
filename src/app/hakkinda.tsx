import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { tr } from '@/i18n/tr';
import { Card, IconButton, Screen, space, Text } from '@/ui';

export default function AboutScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
            <Text variant="heading">‹</Text>
          </IconButton>
          <Text variant="title">{tr.about.title}</Text>
        </View>

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
      </View>
    </Screen>
  );
}
