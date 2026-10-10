import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ROBOT } from '@/components/space/cosmos';
import { useTheme } from '@/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RobotMood = 'happy' | 'worried' | 'sad';

/** The drawing's own coordinate space; `size` scales it. Height is 1.2× width. */
const VIEW_W = 100;
const VIEW_H = 120;

/**
 * The launcher robot — the game's mascot, drawn as one SVG so it stays crisp
 * at any size and themes for free. Used big on the home screen and the
 * onboarding, small on the board (where it replaces the old View-built
 * console), and on the game-over sheet with the matching face.
 *
 * `trims` lets a multi-colour board theme (Gökkuşağı) paint the ears, arms
 * and antenna in its own palette — the same hues the blocks cycle through.
 */
export function Robot({
  size,
  accent,
  ballColor,
  mood = 'happy',
  pose = 'idle',
  trims,
  animated = true,
}: {
  /** Rendered width in dp — derive it from `useScreen`, never a literal. */
  size: number;
  accent: string;
  /** The equipped ball: shown in the chest core and, when throwing, in hand. */
  ballColor: string;
  mood?: RobotMood;
  /** `throw` raises the right arm with a ball in it — the home-screen pose. */
  pose?: 'idle' | 'throw';
  trims?: string[];
  /** Idle bob + antenna pulse. Off for places that re-render every frame. */
  animated?: boolean;
}) {
  const { scheme } = useTheme();
  const body = ROBOT[scheme];
  const reduced = useReducedMotion();
  const move = animated && !reduced;

  const trim = (i: number) => (trims && trims.length > 0 ? trims[i % trims.length]! : accent);

  const bob = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!move) return;
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, [move, bob, pulse]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * size * 0.04 }] }));
  const tipProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  const height = size * (VIEW_H / VIEW_W);

  // Eyes live inside the visor and carry the mood — the one part of the
  // face that reads at a glance even at the board's small size.
  const eyes =
    mood === 'sad' ? (
      <G stroke={accent} strokeWidth={3} strokeLinecap="round">
        <Line x1={37} y1={37} x2={45} y2={39} />
        <Line x1={63} y1={37} x2={55} y2={39} />
      </G>
    ) : mood === 'worried' ? (
      <G fill={accent}>
        <Circle cx={41} cy={35} r={4.6} />
        <Circle cx={59} cy={35} r={4.6} />
      </G>
    ) : (
      <G stroke={accent} strokeWidth={3.4} strokeLinecap="round" fill="none">
        <Path d="M36 37 Q41 30 46 37" />
        <Path d="M54 37 Q59 30 64 37" />
      </G>
    );

  return (
    <View style={{ width: size, height }} pointerEvents="none">
      <Animated.View style={[{ width: size, height }, bobStyle]}>
        <Svg width={size} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <RadialGradient id="core" cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor={body.highlight} stopOpacity={0.85} />
              <Stop offset="0.35" stopColor={ballColor} stopOpacity={1} />
              <Stop offset="1" stopColor={ballColor} stopOpacity={1} />
            </RadialGradient>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.55} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Antenna */}
          <Line x1={50} y1={19} x2={50} y2={7} stroke={body.joint} strokeWidth={2.5} />
          <Circle cx={50} cy={6} r={9} fill="url(#glow)" />
          <AnimatedCircle cx={50} cy={6} r={4} fill={trim(2)} animatedProps={tipProps} />

          {/* Ears */}
          <Rect x={17} y={28} width={8} height={14} rx={3} fill={trim(3)} />
          <Rect x={75} y={28} width={8} height={14} rx={3} fill={trim(4)} />

          {/* Head + visor */}
          <Rect x={23} y={18} width={54} height={36} rx={13} fill={body.shell} stroke={body.shellShade} strokeWidth={2} />
          <Rect x={29} y={24} width={42} height={23} rx={10} fill={body.visor} />
          <Path d="M33 28 Q40 25 47 26" stroke={body.highlight} strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round" fill="none" />
          {eyes}

          {/* Neck */}
          <Rect x={44} y={53} width={12} height={6} rx={2} fill={body.joint} />

          {/* Arms: left always down, right either down or raised with a ball. */}
          <Rect x={13} y={62} width={11} height={24} rx={5.5} fill={trim(0)} transform="rotate(12 18 62)" />
          {pose === 'throw' ? (
            <>
              <Rect x={76} y={38} width={11} height={26} rx={5.5} fill={trim(1)} transform="rotate(28 81 64)" />
              <Circle cx={92} cy={37} r={7} fill="url(#core)" stroke={body.visor} strokeOpacity={0.25} strokeWidth={1} />
            </>
          ) : (
            <Rect x={76} y={62} width={11} height={24} rx={5.5} fill={trim(1)} transform="rotate(-12 82 62)" />
          )}

          {/* Body with the ball-coloured core */}
          <Rect x={24} y={58} width={52} height={38} rx={12} fill={body.shell} stroke={body.shellShade} strokeWidth={2} />
          <Rect x={30} y={88} width={40} height={4} rx={2} fill={body.shellShade} opacity={0.6} />
          <Circle cx={50} cy={74} r={13} fill="url(#glow)" />
          <Circle cx={50} cy={74} r={8.5} fill="url(#core)" stroke={accent} strokeWidth={2.5} />

          {/* Legs + feet */}
          <Rect x={35} y={95} width={9} height={12} rx={3} fill={body.joint} />
          <Rect x={56} y={95} width={9} height={12} rx={3} fill={body.joint} />
          <Rect x={30} y={105} width={17} height={7} rx={3.5} fill={trim(0)} />
          <Rect x={53} y={105} width={17} height={7} rx={3.5} fill={trim(1)} />
        </Svg>
      </Animated.View>
      {/* The shadow stays put while the robot bobs — that is what sells the bob. */}
      <Svg
        width={size}
        height={height * 0.08}
        viewBox="0 0 100 10"
        style={{ position: 'absolute', bottom: -height * 0.03, left: 0 }}>
        <Ellipse cx={50} cy={5} rx={26} ry={3.5} fill={accent} opacity={0.25} />
      </Svg>
    </View>
  );
}
