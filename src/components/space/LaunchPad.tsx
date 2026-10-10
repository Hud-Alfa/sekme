import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

import { Robot, type RobotMood } from '@/components/space/Robot';
import { settle, space, useColors } from '@/ui';

/** The launch pad's minimum height in robot heights — the robot plus a strip
 * of visible ground under its feet. */
export const PAD_ROBOT_RATIO = 1.6;

/** How much of the pad's width the horizon bulges upward in the middle. */
const ARC = 0.07;

/**
 * The strip under the board: a small planet's surface with the launcher
 * robot standing on it. It takes whatever height is left in the frame — so
 * the leftover space on a tall phone becomes ground and sky instead of a
 * blank band — and the robot walks to wherever the next shot fires from,
 * so the ball always reads as leaving the robot's hand.
 */
export function LaunchPad({
  width,
  launchX,
  robotSize: preferred,
  minRobotSize,
  accent,
  ballColor,
  mood,
  trims,
}: {
  width: number;
  /** 0–1 across the board, the same value the physics launches from. */
  launchX: number;
  /** The robot's natural width… */
  robotSize: number;
  /** …and the smallest it may shrink to when the pad is short. */
  minRobotSize: number;
  accent: string;
  ballColor: string;
  mood: RobotMood;
  trims?: string[];
}) {
  const colors = useColors();
  const [h, setH] = useState(0);

  // The robot takes what the measured pad can hold, between the two sizes.
  const robotSize = h > 0 ? Math.max(minRobotSize, Math.min(preferred, h / (1.2 * PAD_ROBOT_RATIO))) : preferred;
  const robotH = robotSize * 1.2;
  const bulge = width * ARC;
  // Where the ground is highest (the middle). Right under the robot's feet,
  // near the top of the pad, so the robot stands just below the launch
  // marker and everything beneath it is planet surface, not empty sky.
  const horizon = robotH + space.xs;
  // The surface is a parabola: highest in the middle, dropping to the edges.
  const surfaceAt = (px: number) => {
    const u = (px / width) * 2 - 1;
    return horizon + bulge * u * u;
  };

  const targetX = Math.min(Math.max(launchX * width, robotSize / 2), width - robotSize / 2);
  const x = useSharedValue(targetX);
  const y = useSharedValue(surfaceAt(targetX));
  useEffect(() => {
    x.value = settle(targetX);
    y.value = settle(surfaceAt(targetX));
    // surfaceAt only depends on width/h, both tracked below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, h, width]);

  const robotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - robotSize / 2 }, { translateY: y.value - robotH }],
  }));

  // A quadratic Bézier through both edges with its control point at
  // horizon − bulge traces exactly the parabola above.
  const edge = horizon + bulge;
  const rim = `M 0 ${edge} Q ${width / 2} ${horizon - bulge} ${width} ${edge}`;

  return (
    <View style={{ flex: 1, width, minHeight: minRobotSize * 1.2 * PAD_ROBOT_RATIO }} onLayout={(e) => setH(e.nativeEvent.layout.height)} pointerEvents="none">
      {h > 0 ? (
        <>
          <Svg width={width} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={accent} stopOpacity={0.04} />
              </LinearGradient>
            </Defs>
            <Path d={`${rim} L ${width} ${h} L 0 ${h} Z`} fill="url(#ground)" />
            <Path
              d={rim}
              stroke={accent}
              strokeOpacity={0.6}
              strokeWidth={2}
              fill="none"
            />
            {/* Craters, placed by fraction so they stay on the ground at any size. */}
            {[
              [0.12, 0.2, 0.05],
              [0.34, 0.5, 0.035],
              [0.72, 0.25, 0.06],
              [0.88, 0.62, 0.03],
              [0.55, 0.8, 0.045],
              [0.2, 0.78, 0.028],
            ].map(([fx, fy, fr], i) => {
              const cx = fx! * width;
              const s = surfaceAt(cx);
              const cy = s + (h - s) * fy!;
              return (
                <Ellipse
                  key={i}
                  cx={cx}
                  cy={cy}
                  rx={fr! * width}
                  ry={fr! * width * 0.4}
                  fill={colors.bg}
                  fillOpacity={0.35}
                  stroke={accent}
                  strokeOpacity={0.25}
                />
              );
            })}
            {/* Landing lights along the horizon. */}
            {[0.08, 0.25, 0.75, 0.92].map((fx, i) => (
              <Circle key={i} cx={fx * width} cy={surfaceAt(fx * width) + 1} r={2.5} fill={accent} opacity={0.8} />
            ))}
          </Svg>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, robotStyle]}>
            <Robot size={robotSize} accent={accent} ballColor={ballColor} mood={mood} trims={trims} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
