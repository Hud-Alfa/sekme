import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSettings } from '@/store/settings';
import { Button, Card, Screen, space, Text } from '@/ui';

/**
 * Template home screen. Each app replaces this entirely — what stays is the
 * shape: one screen, one job, the primary action within thumb reach.
 */
export default function HomeScreen() {
  const router = useRouter();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Screen scroll>
      <View style={{ gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          <Text variant="title">Şablon</Text>
          <Text variant="body" color="textMuted">
            Bu ekran her uygulamada baştan yazılır. Duran şey iskelet: tek ekran, tek iş.
          </Text>
        </View>

        <Card>
          <View style={{ gap: space.md }}>
            <Text variant="heading">Sıradaki adım</Text>
            <Text variant="body" color="textMuted">
              Tasarım sisteminin tamamını görmek için bileşen vitrinine bak.
            </Text>
            <Button label="Bileşen vitrini" onPress={() => router.push('/vitrin')} />
          </View>
        </Card>

        <Button label="Ayarlar" variant="secondary" onPress={() => router.push('/ayarlar')} />
      </View>
    </Screen>
  );
}
