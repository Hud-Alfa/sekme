import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Orb } from '@/components/space/Orb';
import { Robot } from '@/components/space/Robot';

const STREAM = 6;

/**
 * The home screen's centrepiece: the robot standing at the bottom, firing
 * the equipped ball up into space again and again — the game's whole premise
 * in one looping picture, before the player has read a word.
 *
 * `width`/`height` are the box it has been given (measured by the caller);
 * the robot and every trajectory are derived from them.
 */
export function LaunchHero({
  width,
  height,
  accent,
  ballColor,
}: {
  width: number;
  height: number;
  accent: string;
  ballColor: string;
}) {
  const reduced = useReducedMotion();
  // The robot takes at most ~55% of the box height, and never more than
  // ~46% of its width — a tall phone and a short one both keep sky above it.
  const robot = Math.max(0, Math.min(width * 0.46, (height * 0.55) / 1.2));
  const robotLeft = (width - robot) / 2;
  const robotTop = height - robot * 1.2;
  // The raised hand, in the robot drawing's own 100×120 coordinates.
  const handX = robotLeft + robot * 0.92;
  const handY = robotTop + robot * 1.2 * (37 / 120);
  const ball = robot * 0.14;

  const shots = useMemo(
    () =>
      Array.from({ length: STREAM }, (_, i) => {
        // Fan from up-left to up-right, the way a real aim sweeps.
        const spread = (i / (STREAM - 1)) * 2 - 1;
        const angle = -Math.PI / 2 + spread * 0.55;
        const reach = Math.max(height, width) * 0.95;
        return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach, delay: i * 380 };
      }),
    [height, width],
  );

  if (robot <= 0) return null;

  return (
    <View style={{ width, height }} pointerEvents="none">
      {reduced
        ? null
        : shots.map((s, i) => (
            <Shot key={i} x={handX} y={handY} dx={s.dx} dy={s.dy} delay={s.delay} size={ball} color={ballColor} />
          ))}
      <View style={{ position: 'absolute', left: robotLeft, top: robotTop }}>
        <Robot size={robot} accent={accent} ballColor={ballColor} pose="throw" />
      </View>
    </View>
  );
}

function Shot({
  x,
  y,
  dx,
  dy,
  delay,
  size,
  color,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  size: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 380 * STREAM - 1900 > 0 ? 380 * STREAM - 1900 : 400 }),
        ),
        -1,
      ),
    );
  }, [t, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value * t.value,
    transform: [
      { translateX: x - size / 2 + dx * t.value },
      { translateY: y - size / 2 + dy * t.value },
      { scale: 1 - t.value * 0.45 },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <Orb size={size} color={color} glow />
    </Animated.View>
  );
}
