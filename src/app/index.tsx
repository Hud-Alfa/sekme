import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { Difficulty } from '@/game/curve';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/lib/format';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { Button, Card, IconButton, radius, Screen, Sheet, StatTile, space, Text, useColors, useScreen } from '@/ui';

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'kolay', label: tr.game.kolay, hint: tr.game.kolayHint },
  { id: 'orta', label: tr.game.orta, hint: tr.game.ortaHint },
  { id: 'zor', label: tr.game.zor, hint: tr.game.zorHint },
];

/**
 * Home. The only screen that decides whether a run is starting fresh or
 * picking up where it left off — everything past that lives in oyun.tsx,
 * which never has to ask "is there already a game?" again.
 */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const load = useGame((s) => s.load);
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const newGame = useGame((s) => s.newGame);

  const { height: screenHeight } = useScreen();
  const [showDifficulty, setShowDifficulty] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!onboardingDone) return <Redirect href="/onboarding" />;

  const hasRun = game !== null;
  const bestScore = Math.max(
    progress.highScores.kolay,
    progress.highScores.orta,
    progress.highScores.zor,
  );

  const start = async (difficulty: Difficulty) => {
    setShowDifficulty(false);
    await newGame(difficulty);
    router.push('/oyun');
  };

  return (
    <Screen>
      <View style={{ flex: 1, gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: space.md }}>
            <StatTile value={formatNumber(bestScore)} label={tr.game.best} />
            <StatTile value={formatNumber(progress.gold)} label={tr.game.gold} tone="warning" />
          </View>
          <IconButton
            accessibilityLabel={tr.settings.title}
            tinted
            onPress={() => router.push('/ayarlar')}>
            <Text variant="heading">⚙</Text>
          </IconButton>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: space.xxl }}>
          <View style={{ gap: space.md, alignItems: 'center' }}>
            {/* A small brand mark rather than the title floating on bare
                black — a ring and a dot, the same launch-marker shape the
                board itself uses, so the empty-black-screen complaint has
                at least one graphical anchor before the buttons start. */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
            <View style={{ gap: space.xs, alignItems: 'center' }}>
              <Text variant="display">{tr.app.name}</Text>
              <Text variant="body" color="textMuted">
                {tr.app.tagline}
              </Text>
            </View>
          </View>

          <Card style={{ minHeight: screenHeight * 0.22, justifyContent: 'center' }}>
            <View style={{ gap: space.md }}>
              {ready ? (
                <>
                  {hasRun ? (
                    <Button label={tr.game.resume} onPress={() => router.push('/oyun')} />
                  ) : null}
                  <Button
                    label={tr.game.newGame}
                    variant={hasRun ? 'secondary' : 'primary'}
                    onPress={() => setShowDifficulty(true)}
                  />
                  <Button
                    label={tr.game.store}
                    variant="secondary"
                    onPress={() => router.push('/kapsul')}
                  />
                </>
              ) : null}
            </View>
          </Card>
        </View>
      </View>

      <Sheet
        visible={showDifficulty}
        onClose={() => setShowDifficulty(false)}
        title={tr.game.pickDifficultyTitle}>
        <View style={{ gap: space.lg }}>
          {hasRun ? (
            <Text variant="body" color="textMuted">
              {tr.game.newRunConfirmBody}
            </Text>
          ) : null}
          <View style={{ gap: space.md }}>
            {DIFFICULTIES.map((d) => (
              <Button
                key={d.id}
                label={`${d.label} — ${d.hint}`}
                variant={d.id === 'orta' ? 'primary' : 'secondary'}
                onPress={() => void start(d.id)}
              />
            ))}
          </View>
          <Button label={tr.common.cancel} variant="ghost" onPress={() => setShowDifficulty(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
