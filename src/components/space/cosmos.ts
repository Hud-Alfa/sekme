import type { ColorScheme } from '@/ui';

/**
 * The space scenery's own colours — app-specific, so they live here rather
 * than in `src/ui/tokens.ts` (that file is synced from `sablon` and would
 * lose them on the next `/ui-sync`).
 *
 * Nothing here is a UI colour: text, buttons and cards still come from the
 * series tokens. These only paint the backdrop behind them, and each scheme
 * is tuned so the series' own `text`/`textMuted` keep 4.5:1 on top of it —
 * deep space for dark, a pale dawn sky for light.
 */
export type Cosmos = {
  skyTop: string;
  skyBottom: string;
  /** Soft colour clouds behind everything. */
  nebulaA: string;
  nebulaB: string;
  star: string;
  planet: string;
  planetShade: string;
  ring: string;
  moon: string;
  /** Faint horizon glow the robot stands on. */
  ground: string;
};

const dark: Cosmos = {
  skyTop: '#05071A',
  skyBottom: '#15103A',
  nebulaA: '#6B3CFF',
  nebulaB: '#16C2B0',
  star: '#E8ECFF',
  planet: '#FF8A5B',
  planetShade: '#7A2E5C',
  ring: '#FFD9A8',
  moon: '#B9C3E8',
  ground: '#5FE0A0',
};

const light: Cosmos = {
  skyTop: '#E9ECFF',
  skyBottom: '#FBF4FF',
  nebulaA: '#9E86FF',
  nebulaB: '#4FD6C4',
  star: '#5B5FA8',
  planet: '#FF9E78',
  planetShade: '#C75A86',
  ring: '#E0A86A',
  moon: '#A3ACD6',
  ground: '#0C8049',
};

export const COSMOS: Record<ColorScheme, Cosmos> = { dark, light };

/** The robot's fixed body colours, independent of board theme. */
export const ROBOT = {
  dark: { shell: '#E6EAF7', shellShade: '#A9B2D3', visor: '#0E1330', joint: '#5A6390', highlight: '#FFFFFF' },
  light: { shell: '#FFFFFF', shellShade: '#C5CBE6', visor: '#1B2150', joint: '#7C84B3', highlight: '#FFFFFF' },
} as const;

/** Tiny deterministic PRNG so the star field is the same every mount — no
 * reshuffle flicker when a screen remounts. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Card colour, mostly opaque, for panels that float over the scenery: the
 * sky shows at the edges while text keeps the card's own contrast. */
export function glassOf(surface: string, scheme: ColorScheme): string {
  return `${surface}${scheme === 'dark' ? 'D9' : 'E6'}`;
}

/** True for a saturated, reasonably light colour — the ones that stay
 * visible on both the night sky and the dawn sky. */
export function isVivid(hex: string): boolean {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 90 && Math.max(r, g, b) - Math.min(r, g, b) > 60;
}
