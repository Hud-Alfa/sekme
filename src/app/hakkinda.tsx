import Constants from 'expo-constants';
import { View } from 'react-native';

import { BackButton } from '@/components/space/BackButton';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import { tr } from '@/i18n/tr';
import { Card, Screen, space, Text } from '@/ui';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll backdrop={<SpaceBackdrop variant="calm" />}>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <BackButton />
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
