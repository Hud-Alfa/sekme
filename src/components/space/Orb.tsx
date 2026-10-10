import { useId } from 'react';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { ROBOT } from '@/components/space/cosmos';
import { useTheme } from '@/ui';

/**
 * A ball drawn as a lit sphere — highlight top-left, its own colour in the
 * middle, a darker rim — instead of a flat disc. Used wherever a ball is
 * shown as an object to look at (shop, capsule reveal, home screen); the
 * board keeps its lighter View-based dots for the 60-ball frame budget.
 */
export function Orb({ size, color, glow = false }: { size: number; color: string; glow?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { scheme } = useTheme();
  const hi = ROBOT[scheme].highlight;
  const pad = glow ? size * 0.35 : 0;
  const full = size + pad * 2;
  const c = full / 2;

  return (
    <Svg width={full} height={full} style={glow ? { margin: -pad } : undefined}>
      <Defs>
        <RadialGradient id={`o${id}`} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor={hi} stopOpacity={0.95} />
          <Stop offset="0.25" stopColor={color} />
          <Stop offset="1" stopColor={color} />
        </RadialGradient>
        <RadialGradient id={`g${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor={color} stopOpacity={0.5} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {glow ? <Circle cx={c} cy={c} r={c} fill={`url(#g${id})`} /> : null}
      <Circle cx={c} cy={c} r={size / 2} fill={`url(#o${id})`} />
      {/* Rim shade: the same colour darkened by an overlay ring. */}
      <Circle cx={c} cy={c} r={size / 2 - size * 0.04} fill="none" stroke={ROBOT[scheme].visor} strokeOpacity={0.22} strokeWidth={size * 0.08} />
    </Svg>
  );
}
