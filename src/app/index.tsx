import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { tr } from '@/i18n/tr';
import { formatNumber } from '@/lib/format';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { Button, IconButton, Screen, Sheet, space, Text, useScreen } from '@/ui';

/**
 * Home. The only screen that decides whether a run is starting fresh or
 * picking up where it left off — everything past that lives in oyun.tsx,
 * which never has to ask "is there already a game?" again.
 */
export default function HomeScreen() {
  const router = useRouter();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const load = useGame((s) => s.load);
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const newGame = useGame((s) => s.newGame);

  const { height: screenHeight } = useScreen();
  const [showNewRunConfirm, setShowNewRunConfirm] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!onboardingDone) return <Redirect href="/onboarding" />;

  const hasRun = game !== null;

  return (
    <Screen>
      <View style={{ flex: 1, gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: space.lg }}>
            <Stat label={tr.game.best} value={formatNumber(progress.highScore)} />
            <Stat label={tr.game.gold} value={formatNumber(progress.gold)} />
          </View>
          <IconButton
            accessibilityLabel={tr.settings.title}
            tinted
            onPress={() => router.push('/ayarlar')}>
            <Text variant="heading">⚙</Text>
          </IconButton>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: space.xxxl }}>
          <View style={{ gap: space.xs, alignItems: 'center' }}>
            <Text variant="display">{tr.app.name}</Text>
            <Text variant="body" color="textMuted">
              {tr.app.tagline}
            </Text>
          </View>

          <View style={{ gap: space.md, minHeight: screenHeight * 0.22 }}>
            {ready ? (
              <>
                {hasRun ? (
                  <Button label={tr.game.resume} onPress={() => router.push('/oyun')} />
                ) : null}
                <Button
                  label={tr.game.newGame}
                  variant={hasRun ? 'secondary' : 'primary'}
                  onPress={async () => {
                    if (hasRun) {
                      setShowNewRunConfirm(true);
                      return;
                    }
                    await newGame();
                    router.push('/oyun');
                  }}
                />
                <Button
                  label={tr.game.store}
                  variant="secondary"
                  onPress={() => router.push('/kapsul')}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>

      <Sheet
        visible={showNewRunConfirm}
        onClose={() => setShowNewRunConfirm(false)}
        title={tr.game.newRunConfirmTitle}>
        <View style={{ gap: space.lg }}>
          <Text variant="body" color="textMuted">
            {tr.game.newRunConfirmBody}
          </Text>
          <Button
            label={tr.game.newRunConfirmAction}
            variant="danger"
            onPress={async () => {
              setShowNewRunConfirm(false);
              await newGame();
              router.push('/oyun');
            }}
          />
          <Button
            label={tr.common.cancel}
            variant="ghost"
            onPress={() => setShowNewRunConfirm(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="heading" numeric>
        {value}
      </Text>
    </View>
  );
}
