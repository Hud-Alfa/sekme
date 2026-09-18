import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { exportDatabase, wipeDatabase } from '@/db';
import { tr } from '@/i18n/tr';
import { formatTimeOfDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/notifications';
import { useSettings, type ThemePreference } from '@/store/settings';
import {
  Button,
  Card,
  IconButton,
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

  async function toggleNotifications(next: boolean) {
    if (!next) {
      await cancelDailyReminder();
      s.setNotifications(false);
      return;
    }

    const ok = await scheduleDailyReminder(
      s.reminderMinutes,
      tr.app.name,
      'Bugün nasıl gidiyor?',
    );

    // Keep the toggle honest: if permission was refused it stays off.
    s.setNotifications(ok);
    if (!ok) Alert.alert(tr.settings.notifications, tr.settings.notificationsDenied);
  }

  async function exportData() {
    setBusy(true);
    try {
      const dump = await exportDatabase();
      const payload = JSON.stringify(
        { app: tr.app.name, exportedAt: new Date().toISOString(), data: dump },
        null,
        2,
      );

      const file = new File(Paths.cache, `${Constants.expoConfig?.slug ?? 'app'}-verilerim.json`);
      file.create({ overwrite: true });
      file.write(payload);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      } else {
        Alert.alert(tr.settings.exportData, `Dosya kaydedildi:\n${file.uri}`);
      }
    } catch {
      Alert.alert(tr.common.error, 'Verilerin dışa aktarılamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEverything() {
    haptic.heavy();
    setBusy(true);
    try {
      await cancelDailyReminder();
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
    <Screen scroll>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
            <Text variant="heading">‹</Text>
          </IconButton>
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

        <Section title={tr.settings.notifications}>
          <ListRow
            title={tr.settings.reminder}
            subtitle={
              s.notificationsEnabled
                ? `Her gün ${formatTimeOfDay(s.reminderMinutes)}`
                : 'Kapalı'
            }
            last
            accessory={
              <Switch
                value={s.notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={tr.settings.reminder}
              />
            }
          />
        </Section>

        <Section title={tr.settings.data}>
          <ListRow
            title={tr.settings.exportData}
            subtitle={tr.settings.exportHint}
            onPress={exportData}
          />
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
