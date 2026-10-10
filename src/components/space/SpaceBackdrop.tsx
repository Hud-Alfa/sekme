import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { COSMOS, isVivid, seeded, type Cosmos } from '@/components/space/cosmos';
import { BALLS } from '@/game/balls';
import { radius, useScreen, useTheme } from '@/ui';

const STAR_COUNT = 70;
const TWINKLE_COUNT = 10;

/**
 * Animated deep-space scenery that sits behind a screen's content: a sky
 * gradient, two nebula clouds, a fixed star field, a ringed planet and a
 * moon — plus, in `full`, balls streaking across like comets (the game's own
 * ball colours, so the menu already looks like the game).
 *
 * Everything that moves is a transform or opacity on the UI thread; nothing
 * here ever re-renders React after mount. `calm` drops the comets for the
 * board, where the real balls should be the only thing in motion.
 * With the OS reduce-motion setting on, the scene is simply still.
 */
export const SpaceBackdrop = memo(function SpaceBackdrop({
  variant = 'full',
}: {
  variant?: 'full' | 'calm';
}) {
  const { scheme } = useTheme();
  const c = COSMOS[scheme];
  const { width, height, scale } = useScreen();
  const reduced = useReducedMotion();

  const stars = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: STAR_COUNT }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: 0.5 + rand() * 1.3,
      o: 0.25 + rand() * 0.6,
    }));
  }, [width, height]);

  const twinkles = useMemo(() => {
    const rand = seeded(19);
    return Array.from({ length: TWINKLE_COUNT }, (_, i) => ({
      x: rand() * width,
      y: rand() * height * 0.85,
      size: scale(3 + rand() * 3),
      delay: i * 420,
      period: 1400 + rand() * 1600,
    }));
  }, [width, height, scale]);

  const planet = scale(74);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.skyTop} />
            <Stop offset="1" stopColor={c.skyBottom} />
          </LinearGradient>
          <RadialGradient id="nebA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.nebulaA} stopOpacity={scheme === 'dark' ? 0.32 : 0.22} />
            <Stop offset="1" stopColor={c.nebulaA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="nebB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.nebulaB} stopOpacity={scheme === 'dark' ? 0.22 : 0.18} />
            <Stop offset="1" stopColor={c.nebulaB} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ground" cx="50%" cy="100%" r="60%">
            <Stop offset="0" stopColor={c.ground} stopOpacity={0.22} />
            <Stop offset="1" stopColor={c.ground} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        <Ellipse cx={width * 0.15} cy={height * 0.3} rx={width * 0.75} ry={height * 0.22} fill="url(#nebA)" />
        <Ellipse cx={width * 0.9} cy={height * 0.68} rx={width * 0.7} ry={height * 0.2} fill="url(#nebB)" />
        <Ellipse cx={width / 2} cy={height} rx={width * 0.9} ry={height * 0.18} fill="url(#ground)" />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={c.star} opacity={s.o} />
        ))}
        {/* A small moon on the far side, still. */}
        <Circle cx={width * 0.12} cy={height * 0.58} r={scale(9)} fill={c.moon} opacity={0.55} />
        <Circle cx={width * 0.12 + scale(3)} cy={height * 0.58 - scale(2)} r={scale(2)} fill={c.skyTop} opacity={0.35} />
      </Svg>

      {/* On the board the planet would sit behind the grid and just muddy
          it — the menu screens get it, the game does not. */}
      {variant === 'full' ? (
        <Planet c={c} size={planet} left={width - planet * 1.05} top={height * 0.1} still={reduced} />
      ) : null}

      {reduced
        ? null
        : twinkles.map((t, i) => <Twinkle key={i} {...t} color={c.star} />)}

      {variant === 'full' && !reduced ? <Comets width={width} height={height} scale={scale} /> : null}
    </View>
  );
});

function Planet({ c, size, left, top, still }: { c: Cosmos; size: number; left: number; top: number; still: boolean }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    drift.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [still, drift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value * size * 0.08 }, { rotate: `${-18 + drift.value * 4}deg` }],
  }));

  // Ring drawn in two halves — the back half under the planet, the front half
  // over it — so it reads as wrapping around rather than a flat sticker.
  const w = size * 1.8;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const r = size * 0.36;
  const rx = size * 0.82;
  const ry = size * 0.2;

  return (
    <Animated.View style={[{ position: 'absolute', left: left - (w - size) / 2, top, width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="planet" cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor={c.planet} />
            <Stop offset="1" stopColor={c.planetShade} />
          </RadialGradient>
        </Defs>
        <Path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`}
          stroke={c.ring}
          strokeWidth={size * 0.05}
          strokeOpacity={0.55}
          fill="none"
        />
        <Circle cx={cx} cy={cy} r={r} fill="url(#planet)" />
        <Path
          d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`}
          stroke={c.ring}
          strokeWidth={size * 0.05}
          strokeOpacity={0.85}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

function Twinkle({
  x,
  y,
  size,
  delay,
  period,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  period: number;
  color: string;
}) {
  const o = useSharedValue(0.15);
  useEffect(() => {
    o.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: period }), withTiming(0.15, { duration: period })), -1),
    );
  }, [o, delay, period]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.6 + o.value * 0.5 }] }));

  // A four-point sparkle rather than another dot — it is what makes the
  // field read as "stars" and not as dust.
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2 }, style]}>
      <Svg width={size * 2} height={size * 2} viewBox="0 0 20 20">
        <Path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** Colours the comets borrow from the real ball catalogue — only the bright
 * ones: a near-black or grey ball would vanish against the night sky. */
const COMET_COLORS = BALLS.map((b) => b.color).filter(isVivid);

type CometSpec = { x0: number; y0: number; x1: number; y1: number; size: number; duration: number; delay: number; color: string };

function Comets({ width, height, scale }: { width: number; height: number; scale: (n: number) => number }) {
  const specs = useMemo<CometSpec[]>(() => {
    const rand = seeded(42);
    return Array.from({ length: 6 }, (_, i) => {
      // Mostly bottom-left → top-right, like balls fired upward and away.
      const x0 = -0.2 * width + rand() * width * 0.8;
      const y0 = height * (0.55 + rand() * 0.55);
      const angle = (-35 - rand() * 35) * (Math.PI / 180);
      const dist = Math.hypot(width, height) * 1.1;
      return {
        x0,
        y0,
        x1: x0 + Math.cos(angle) * dist,
        y1: y0 + Math.sin(angle) * dist,
        size: scale(7 + rand() * 7),
        duration: 5200 + rand() * 4200,
        delay: i * 1300 + rand() * 900,
        color: COMET_COLORS[i % COMET_COLORS.length]!,
      };
    });
  }, [width, height, scale]);

  return (
    <>
      {specs.map((s, i) => (
        <Comet key={i} spec={s} />
      ))}
    </>
  );
}

function Comet({ spec }: { spec: CometSpec }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.duration, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          // Rest off-screen between passes, so the sky is never crowded.
          withTiming(0, { duration: spec.duration * 0.6 }),
        ),
        -1,
      ),
    );
  }, [t, spec]);

  return <CometBody spec={spec} t={t} />;
}

function CometBody({ spec, t }: { spec: CometSpec; t: SharedValue<number> }) {
  const tail = spec.size * 7;
  const angle = Math.atan2(spec.y1 - spec.y0, spec.x1 - spec.x0);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: spec.x0 + (spec.x1 - spec.x0) * t.value },
      { translateY: spec.y0 + (spec.y1 - spec.y0) * t.value },
      { rotate: `${angle}rad` },
    ],
  }));

  // The view's origin is the ball's centre; the tail extends behind it (to
  // the left before rotation), so a single rotate points the whole streak
  // along its path.
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, style]}>
      <View style={{ position: 'absolute', left: -tail, top: -spec.size / 2, width: tail, height: spec.size }}>
        <Svg width={tail} height={spec.size}>
          <Defs>
            <LinearGradient id={`tail-${spec.color}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={spec.color} stopOpacity={0} />
              <Stop offset="1" stopColor={spec.color} stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          <Path
            d={`M 0 ${spec.size / 2} L ${tail} ${spec.size * 0.1} L ${tail} ${spec.size * 0.9} Z`}
            fill={`url(#tail-${spec.color})`}
          />
        </Svg>
      </View>
      <View
        style={{
          position: 'absolute',
          left: -spec.size / 2,
          top: -spec.size / 2,
          width: spec.size,
          height: spec.size,
          borderRadius: radius.pill,
          backgroundColor: spec.color,
          boxShadow: `0 0 ${spec.size}px ${spec.color}`,
        }}
      />
    </Animated.View>
  );
}
