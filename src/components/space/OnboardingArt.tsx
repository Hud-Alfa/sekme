import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { COSMOS, isVivid } from '@/components/space/cosmos';
import { Orb } from '@/components/space/Orb';
import { Robot } from '@/components/space/Robot';
import { BALLS } from '@/game/balls';
import { radius, useColors, useTheme } from '@/ui';

/**
 * One illustration per onboarding page, all built from the game's own
 * pieces — the robot, lit balls, the board's blocks — so the first three
 * screens already look like the game instead of empty tinted boxes.
 */
export function OnboardingArt({ step, size }: { step: number; size: number }) {
  const colors = useColors();
  const { scheme } = useTheme();
  const c = COSMOS[scheme];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: `${colors.surface}B3`,
        alignSelf: 'center',
      }}>
      {step === 0 ? <AimArt size={size} accent={colors.accent} text={colors.onAccent} /> : null}
      {step === 1 ? <FlowArt size={size} accent={colors.accent} gold={colors.warning} star={c.star} /> : null}
      {step === 2 ? <DataArt size={size} accent={colors.accent} muted={colors.textMuted} /> : null}
    </View>
  );
}

/** Page 1: a tiny board, the aim line and the path a ball takes bouncing up. */
function AimArt({ size, accent, text }: { size: number; accent: string; text: string }) {
  const blocks: [number, number, number][] = [
    [18, 14, 3],
    [42, 14, 7],
    [66, 26, 2],
    [30, 38, 5],
  ];
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {blocks.map(([x, y, n], i) => (
          <G key={i}>
            <Rect x={x} y={y} width={20} height={20} rx={4} fill={accent} opacity={0.9} />
            <SvgText x={x + 10} y={y + 14} fontSize={10} fontWeight="700" fill={text} textAnchor="middle">
              {n}
            </SvgText>
          </G>
        ))}
        {/* Bounce path: up from the robot, off the right wall, into a block. */}
        <Polyline
          points="50,78 92,56 80,47"
          fill="none"
          stroke={accent}
          strokeWidth={1.6}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <Circle cx={92} cy={56} r={2} fill={accent} />
        <Line x1={4} y1={82} x2={96} y2={82} stroke={accent} strokeOpacity={0.4} strokeWidth={1} />
      </Svg>
      <View style={{ position: 'absolute', left: size * 0.83, top: size * 0.47 }}>
        <Orb size={size * 0.07} color={BALLS[2]!.color} glow />
      </View>
      <View style={{ position: 'absolute', left: size * 0.41, top: size * 0.62 }}>
        <Robot size={size * 0.18} accent={accent} ballColor={BALLS[2]!.color} animated={false} />
      </View>
    </>
  );
}

/** Page 2: the robot juggling the collection, coins drifting around it. */
function FlowArt({ size, accent, gold, star }: { size: number; accent: string; gold: string; star: string }) {
  const orbit = BALLS.filter((b) => isVivid(b.color)).slice(0, 6);
  const r = size * 0.36;
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Circle cx={50} cy={50} r={36} fill="none" stroke={accent} strokeOpacity={0.35} strokeDasharray="2 4" />
        {/* Infinity: no levels, one endless run. */}
        <Path
          d="M34 12 C 34 5, 45 5, 50 12 C 55 19, 66 19, 66 12 C 66 5, 55 5, 50 12 C 45 19, 34 19, 34 12 Z"
          fill="none"
          stroke={accent}
          strokeWidth={2}
        />
        {[
          [50, 96],
          [90, 50],
          [8, 40],
          [30, 94],
        ].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={1.2} fill={star} />
        ))}
        {[
          [12, 12],
          [88, 88],
          [12, 88],
        ].map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={5} fill={gold} fillOpacity={0.25} stroke={gold} strokeWidth={1.4} />
            <Path d={`M${x! - 1} ${y! - 2.5} V${y! + 2.5}`} stroke={gold} strokeWidth={1.4} strokeLinecap="round" />
          </G>
        ))}
      </Svg>
      {orbit.map((b, i) => {
        const a = (i / orbit.length) * Math.PI * 2 - Math.PI / 2;
        const s = size * 0.085;
        return (
          <View
            key={b.id}
            style={{ position: 'absolute', left: size / 2 + Math.cos(a) * r - s / 2, top: size / 2 + Math.sin(a) * r - s / 2 }}>
            <Orb size={s} color={b.color} />
          </View>
        );
      })}
      <View style={{ position: 'absolute', left: size * 0.35, top: size * 0.3 }}>
        <Robot size={size * 0.3} accent={accent} ballColor={orbit[0]?.color ?? accent} pose="throw" />
      </View>
    </>
  );
}

/** Page 3: the robot next to a document with an export arrow and a bin. */
function DataArt({ size, accent, muted }: { size: number; accent: string; muted: string }) {
  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Rect x={52} y={22} width={30} height={38} rx={4} fill="none" stroke={accent} strokeWidth={2} />
        <Line x1={58} y1={32} x2={76} y2={32} stroke={muted} strokeWidth={2} strokeLinecap="round" />
        <Line x1={58} y1={39} x2={76} y2={39} stroke={muted} strokeWidth={2} strokeLinecap="round" />
        <Line x1={58} y1={46} x2={70} y2={46} stroke={muted} strokeWidth={2} strokeLinecap="round" />
        {/* Export arrow out of the page */}
        <Path d="M67 60 V76 M61 70 L67 76 L73 70" stroke={accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Bin */}
        <Path d="M80 68 H94 M83 68 L84.5 86 H89.5 L91 68 M85 65 H89" stroke={muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      <View style={{ position: 'absolute', left: size * 0.08, top: size * 0.34 }}>
        <Robot size={size * 0.36} accent={accent} ballColor={accent} />
      </View>
    </>
  );
}
