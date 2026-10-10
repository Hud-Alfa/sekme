import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ROBOT } from '@/components/space/cosmos';
import { Orb } from '@/components/space/Orb';
import { BALLS } from '@/game/balls';
import { useTheme } from '@/ui';

/**
 * The shop's hero: a glass capsule dome full of balls, slowly turning, on a
 * small pedestal — what "Kapsül aç" is about to do, drawn before it happens.
 * Width-driven; height is 0.8× width.
 */
export function CapsuleMachine({ width, accent }: { width: number; accent: string }) {
  const { scheme } = useTheme();
  const body = ROBOT[scheme];
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1);
  }, [reduced, spin]);

  const height = width * 0.8;
  const dome = width * 0.5;
  const domeTop = height * 0.04;
  const ball = dome * 0.2;

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  // Balls laid out on two rings inside the dome; the whole cluster turns.
  const inside = BALLS.slice(0, 10).map((b, i) => {
    const ring = i < 6 ? 0.28 : 0.1;
    const count = i < 6 ? 6 : 4;
    const a = ((i % count) / count) * Math.PI * 2;
    return { color: b.color, x: Math.cos(a) * dome * ring, y: Math.sin(a) * dome * ring };
  });

  return (
    <View style={{ width, height, alignItems: 'center' }} pointerEvents="none">
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="stand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={body.shell} />
            <Stop offset="1" stopColor={body.shellShade} />
          </LinearGradient>
        </Defs>
        {/* Pedestal */}
        <Ellipse cx={width / 2} cy={height * 0.95} rx={width * 0.3} ry={height * 0.035} fill={accent} opacity={0.25} />
        <Path
          d={`M ${width / 2 - dome * 0.42} ${domeTop + dome * 0.92} L ${width / 2 - dome * 0.55} ${height * 0.93} L ${width / 2 + dome * 0.55} ${height * 0.93} L ${width / 2 + dome * 0.42} ${domeTop + dome * 0.92} Z`}
          fill="url(#stand)"
        />
        <Rect x={width / 2 - dome * 0.14} y={height * 0.72} width={dome * 0.28} height={height * 0.1} rx={4} fill={body.visor} />
        <Circle cx={width / 2} cy={height * 0.77} r={dome * 0.04} fill={accent} />
        {/* Dome glass */}
        <Circle cx={width / 2} cy={domeTop + dome / 2} r={dome / 2} fill={accent} fillOpacity={0.1} stroke={accent} strokeWidth={2} />
      </Svg>

      <Animated.View
        style={[
          { position: 'absolute', left: width / 2 - dome / 2, top: domeTop, width: dome, height: dome },
          ringStyle,
        ]}>
        {inside.map((b, i) => (
          <View key={i} style={{ position: 'absolute', left: dome / 2 + b.x - ball / 2, top: dome / 2 + b.y - ball / 2 }}>
            <Orb size={ball} color={b.color} />
          </View>
        ))}
      </Animated.View>

      {/* Glass shine over the balls */}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Path
          d={`M ${width / 2 - dome * 0.34} ${domeTop + dome * 0.3} A ${dome * 0.4} ${dome * 0.4} 0 0 1 ${width / 2 - dome * 0.05} ${domeTop + dome * 0.08}`}
          stroke={body.highlight}
          strokeOpacity={0.6}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
