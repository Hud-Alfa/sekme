import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { wipeDatabase } from '@/db';
import { BackButton } from '@/components/space/BackButton';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import { tr } from '@/i18n/tr';
import { haptic } from '@/lib/haptics';
import { useSettings, type ThemePreference } from '@/store/settings';
import {
  Button,
  Card,
  ListRow,
  Screen,
  SegmentedControl,
  Sheet,
  space,
  Text,
  useColors,
  type Segment,
} from '@/ui';

const themeSegments: readonly Segment<ThemePreference>[] = [
  { value: 'system', label: tr.settings.themeSystem },
  { value: 'light', label: tr.settings.themeLight },
  { value: 'dark', label: tr.settings.themeDark },
];

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const s = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deleteEverything() {
    haptic.heavy();
    setBusy(true);
    try {
      await wipeDatabase();
      s.resetAll();
      setConfirmDelete(false);
      router.replace('/onboarding');
    } catch {
      Alert.alert(tr.common.error, 'Veriler silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll backdrop={<SpaceBackdrop variant="calm" />}>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <BackButton />
          <Text variant="title">{tr.settings.title}</Text>
        </View>

        <Section title={tr.settings.appearance}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <Text variant="label" color="textMuted">
              {tr.settings.theme}
            </Text>
            <SegmentedControl
              segments={themeSegments}
              value={s.theme}
              onChange={s.setTheme}
              accessibilityLabel={tr.settings.theme}
            />
          </View>
        </Section>

        <Section title={tr.settings.sound}>
          <ListRow
            title={tr.settings.music}
            subtitle={tr.settings.musicHint}
            accessory={
              <Switch
                value={s.musicEnabled}
                onValueChange={s.setMusic}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={tr.settings.music}
              />
            }
          />
          <ListRow
            title={tr.settings.sfx}
            subtitle={tr.settings.sfxHint}
            last
            accessory={
              <Switch
                value={s.sfxEnabled}
                onValueChange={s.setSfx}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={tr.settings.sfx}
              />
            }
          />
        </Section>

        <Section title={tr.settings.feedback}>
          <ListRow
            title={tr.settings.haptics}
            subtitle={tr.settings.hapticsHint}
            last
            accessory={
              <Switch
                value={s.hapticsEnabled}
                onValueChange={s.setHaptics}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={tr.settings.haptics}
              />
            }
          />
        </Section>

        <Section title={tr.settings.data}>
          <ListRow
            title={tr.settings.deleteData}
            subtitle={tr.settings.deleteHint}
            destructive
            last
            onPress={() => setConfirmDelete(true)}
          />
        </Section>

        <Section title={tr.settings.about}>
          <ListRow title={tr.about.title} onPress={() => router.push('/hakkinda')} />
          <ListRow title={tr.privacy.title} onPress={() => router.push('/gizlilik')} />
          <ListRow
            title={tr.settings.version}
            subtitle={Constants.expoConfig?.version ?? '—'}
            last
          />
        </Section>

      </View>

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={tr.settings.deleteConfirmTitle}>
        <Text variant="body" color="textMuted">
          {tr.settings.deleteConfirmBody}
        </Text>
        <View style={{ gap: space.sm }}>
          <Button
            label={tr.settings.deleteConfirmAction}
            variant="danger"
            loading={busy}
            onPress={deleteEverything}
          />
          <Button
            label={tr.common.cancel}
            variant="ghost"
            onPress={() => setConfirmDelete(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" color="textMuted" style={{ paddingHorizontal: space.xs }}>
        {title.toLocaleUpperCase('tr-TR')}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}
