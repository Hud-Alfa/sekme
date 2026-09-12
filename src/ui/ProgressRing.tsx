import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { timing } from '@/ui/motion';
import { useColors } from '@/ui/theme';
import { duration } from '@/ui/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The hero graphic of every counter screen. Animates its fill on mount and on
 * every change, so a value never snaps into place.
 */
export function ProgressRing({
  progress,
  size = 240,
  thickness = 14,
  children,
  accessibilityLabel,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = timing(Math.max(0, Math.min(1, progress)), duration.slow);
  }, [fill, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the sweep at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
