import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Small line icons for the space-themed screens, replacing the bare Unicode
 * glyphs (⚙ ‹ ↺ ₺) that rendered differently on every Android font. All take
 * a colour token value and a size derived by the caller.
 */
type IconProps = { size: number; color: string };

export function CoinIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />
      <Path d="M10.5 7 V16.5 Q14.5 16.5 15.5 13 M8 11.5 L13.5 9.5 M8 14 L13.5 12" stroke={color} strokeWidth={1.9} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function TrophyIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" fill={color} />
      <Path d="M7 6 H4 V8 A3 3 0 0 0 7 11 M17 6 H20 V8 A3 3 0 0 1 17 11" stroke={color} strokeWidth={1.8} />
      <Rect x={10.5} y={13} width={3} height={4} fill={color} />
      <Rect x={7.5} y={17} width={9} height={3} rx={1} fill={color} />
    </Svg>
  );
}

export function GearIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 L13.6 4.8 L16.4 4.2 L17 7 L19.8 7.6 L19.2 10.4 L21.5 12 L19.2 13.6 L19.8 16.4 L17 17 L16.4 19.8 L13.6 19.2 L12 21.5 L10.4 19.2 L7.6 19.8 L7 17 L4.2 16.4 L4.8 13.6 L2.5 12 L4.8 10.4 L4.2 7.6 L7 7 L7.6 4.2 L10.4 4.8 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function BackIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RestartIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12 A7 7 0 1 1 16.5 6.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17.5 3 V7.2 H13.3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5 L18.5 12 L8 18.5 Z" fill={color} strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5 V19 M5 12 H19" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** A capsule — the shop's own symbol, two halves and a seam. */
export function CapsuleIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
      <Path d="M3.5 12 H20.5" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2.4} fill={color} />
    </Svg>
  );
}
