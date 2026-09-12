import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/ui/theme';

const PIECE_COUNT = 28;
const FALL_MS = 1200;

/**
 * Celebration — reserved for genuine milestones. Firing this for routine events
 * devalues it, so keep the call sites deliberately rare.
 */
export function Confetti({ play, onDone }: { play: boolean; onDone?: () => void }) {
  const colors = useColors();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => onDone?.(), FALL_MS + 400);
    return () => clearTimeout(t);
  }, [play, onDone]);

  if (!play || reduced) return null;

  const pieceColors = [colors.accent, colors.success, colors.warning, colors.danger];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECE_COUNT }, (_, i) => (
        <Piece key={i} index={i} color={pieceColors[i % pieceColors.length]} />
      ))}
    </View>
  );
}

function Piece({ index, color }: { index: number; color: string }) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  // Deterministic spread so pieces never clump and nothing is randomised per frame.
  const startX = ((index * 37) % 100) / 100;
  const drift = (((index * 53) % 100) / 100 - 0.5) * 120;
  const spins = ((index * 71) % 4) + 1;
  const delay = (index % 6) * 60;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: FALL_MS,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * height * 0.9 },
      { translateX: progress.value * drift },
      { rotate: `${progress.value * spins * 360}deg` },
    ],
    opacity: 1 - progress.value * progress.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -20,
          left: startX * width,
          width: 8,
          height: 12,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
