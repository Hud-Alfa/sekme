import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassOf } from '@/components/space/cosmos';
import { CapsuleIcon, CoinIcon, GearIcon, PlayIcon, PlusIcon, TrophyIcon } from '@/components/space/Icons';
import { LaunchHero } from '@/components/space/LaunchHero';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import { findBall } from '@/game/balls';
import type { Difficulty } from '@/game/curve';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import {
  Button,
  duration,
  HIT_SLOP_MIN,
  IconButton,
  radius,
  Screen,
  Sheet,
  space,
  Text,
  useColors,
  useScreen,
  useTheme,
} from '@/ui';

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'kolay', label: tr.game.kolay, hint: tr.game.kolayHint },
  { id: 'orta', label: tr.game.orta, hint: tr.game.ortaHint },
  { id: 'zor', label: tr.game.zor, hint: tr.game.zorHint },
];

/**
 * Home. The only screen that decides whether a run is starting fresh or
 * picking up where it left off — everything past that lives in oyun.tsx,
 * which never has to ask "is there already a game?" again.
 *
 * Visually it is the game's poster: the robot at the bottom firing the
 * equipped ball into an animated sky, the title glowing above it, and the
 * actions on a glass panel at thumb height.
 */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { scheme } = useTheme();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const load = useGame((s) => s.load);
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const newGame = useGame((s) => s.newGame);

  const { scale, isShort } = useScreen();
  const insets = useSafeAreaInsets();
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [heroBox, setHeroBox] = useState({ width: 0, height: 0 });

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
    <Screen backdrop={<SpaceBackdrop />}>
      <View style={{ flex: 1, gap: isShort ? space.md : space.lg, paddingBottom: insets.bottom + space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: space.sm }}>
            <HudPill
              icon={<TrophyIcon size={scale(18)} color={colors.accent} />}
              value={formatNumber(bestScore)}
              label={tr.game.best}
            />
            <HudPill
              icon={<CoinIcon size={scale(18)} color={colors.warning} />}
              value={formatNumber(progress.gold)}
              label={tr.game.gold}
            />
          </View>
          <IconButton accessibilityLabel={tr.settings.title} tinted onPress={() => router.push('/ayarlar')}>
            <GearIcon size={scale(22)} color={colors.text} />
          </IconButton>
        </View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(duration.slow)}
          style={{ alignItems: 'center', gap: space.xs, paddingTop: isShort ? 0 : space.lg }}>
          <Text
            variant="display"
            style={{
              letterSpacing: space.xs,
              // A hard offset shadow in the accent — the arcade-logo look.
              // A blurred glow renders as a solid box on some Android builds.
              textShadowColor: colors.accent,
              textShadowOffset: { width: 0, height: space.xs },
              textShadowRadius: 1,
            }}>
            {tr.app.name.toLocaleUpperCase('tr')}
          </Text>
          <Text variant="body" color="textMuted" center>
            {tr.app.tagline}
          </Text>
        </Animated.View>

        {/* The hero takes whatever height is left, measured — so the robot
            and its launch arcs size to this exact phone, not a guess. */}
        <View style={{ flex: 1 }} onLayout={(e) => setHeroBox(e.nativeEvent.layout)}>
          {heroBox.width > 0 ? (
            <LaunchHero
              width={heroBox.width}
              height={heroBox.height}
              accent={colors.accent}
              ballColor={findBall(progress.selected).color}
            />
          ) : null}
        </View>

        <View
          style={{
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: glassOf(colors.surface, scheme),
          }}>
          {ready ? (
            <>
              {hasRun ? (
                <Button
                  label={tr.game.resume}
                  left={<PlayIcon size={scale(18)} color={colors.onAccent} />}
                  onPress={() => router.push('/oyun')}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button
                  label={tr.game.newGame}
                  variant={hasRun ? 'secondary' : 'primary'}
                  left={
                    hasRun ? (
                      <PlusIcon size={scale(16)} color={colors.text} />
                    ) : (
                      <PlayIcon size={scale(18)} color={colors.onAccent} />
                    )
                  }
                  style={{ flex: 1 }}
                  onPress={() => setShowDifficulty(true)}
                />
                <Button
                  label={tr.game.store}
                  variant="secondary"
                  left={<CapsuleIcon size={scale(18)} color={colors.text} />}
                  style={{ flex: 1 }}
                  onPress={() => router.push('/kapsul')}
                />
              </View>
            </>
          ) : null}
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
          <View style={{ gap: space.sm }}>
            {DIFFICULTIES.map((d, i) => (
              <DifficultyRow key={d.id} level={i + 1} label={d.label} hint={d.hint} onPress={() => void start(d.id)} />
            ))}
          </View>
          <Button label={tr.common.cancel} variant="ghost" onPress={() => setShowDifficulty(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

/** A score/gold readout floating on the sky: icon, number, small label. */
function HudPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  const colors = useColors();
  const { scheme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: HIT_SLOP_MIN,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: glassOf(colors.surface, scheme),
      }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text variant="label" numeric numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** One difficulty choice: three bars that say how hard, name and hint. */
function DifficultyRow({
  level,
  label,
  hint,
  onPress,
}: {
  level: number;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const { scale } = useScreen();
  const featured = level === 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT_SLOP_MIN + space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: featured ? 2 : 1,
        borderColor: featured ? colors.accent : colors.border,
        backgroundColor: pressed ? colors.accentSoft : colors.surfaceAlt,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ width: scale(40), flexDirection: 'row', gap: space.xs, alignItems: 'flex-end', justifyContent: 'center' }}>
        {[1, 2, 3].map((bar) => (
          <View
            key={bar}
            style={{
              width: scale(7),
              height: scale(8 + bar * 7),
              borderRadius: radius.sm,
              backgroundColor: bar <= level ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
      <View style={{ flex: 1, gap: space.xs / 2 }}>
        <Text variant="heading">{label}</Text>
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}
