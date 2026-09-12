/**
 * Design tokens. The single source of visual truth for the whole app series.
 *
 * Each app personalises ONLY `accent`. Everything else stays identical so the
 * apps read as one family. Never write a raw colour, size or spacing value in
 * a screen — add it here first if it is genuinely missing.
 */

/** The one colour that makes this app itself. Change per app, nothing else. */
export const ACCENT = {
  light: '#0C8049',
  dark: '#5FE0A0',
} as const;

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
};

const light: Colors = {
  bg: '#FBFBFD',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F7',
  border: '#E5E5EA',
  text: '#0B0B0F',
  textMuted: '#6E6E78',
  accent: ACCENT.light,
  accentSoft: 'rgba(12, 128, 73, 0.10)',
  onAccent: '#FFFFFF',
  success: '#1FA971',
  warning: '#E0A302',
  danger: '#D94F45',
  overlay: 'rgba(11, 11, 15, 0.45)',
};

const dark: Colors = {
  bg: '#0B0B0F',
  surface: '#16161C',
  surfaceAlt: '#1F1F27',
  border: '#2A2A34',
  text: '#F4F4F7',
  textMuted: '#9A9AA6',
  accent: ACCENT.dark,
  accentSoft: 'rgba(95, 224, 160, 0.16)',
  onAccent: '#0B0B0F',
  success: '#32C48D',
  warning: '#F0B429',
  danger: '#F0655B',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const palette = { light, dark } as const;

export type ColorScheme = keyof typeof palette;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target, in points. Never go below this. */
export const HIT_SLOP_MIN = 44;

export const duration = {
  fast: 150,
  base: 250,
  slow: 400,
  celebrate: 900,
} as const;
