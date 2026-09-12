import { space } from '@/ui/tokens';

/**
 * Screen geometry, in one place.
 *
 * Everything a layout needs to adapt comes from here so that no screen has to
 * invent its own breakpoint. See the `duyarli-tasarim` skill for the rules this
 * implements; the short version is that any number which must fit on screen is
 * derived, never written down.
 *
 * This file is deliberately free of React and react-native imports so that
 * `npm test` can check the whole device matrix without a device. The hook that
 * wraps it lives in `useScreen.ts`.
 */

export type SizeClass = 'compact' | 'regular' | 'large';
export type HeightClass = 'short' | 'tall';

/** The width the series is designed against; `scale` is relative to this. */
export const DESIGN_WIDTH = 390;

/** Below this a phone is cramped — old Androids, iPhone SE, split-screen. */
export const COMPACT_MAX = 360;

/** At and above this we are on a tablet, an unfolded foldable, or a Chromebook. */
export const LARGE_MIN = 600;

/** Below this, stacked hero layouts start to overflow vertically. */
export const SHORT_MAX = 700;

/**
 * Text stops getting more readable past roughly this width, so content is
 * capped and centred on large screens rather than stretched across them.
 */
export const MAX_CONTENT = 560;

/**
 * `scale` is clamped: blowing everything up 2x on a tablet does not make the
 * layout better, it just makes it larger. The clamp keeps proportions sane at
 * both ends.
 */
export const SCALE_MIN = 0.85;
export const SCALE_MAX = 1.25;

export type Screen = {
  width: number;
  height: number;
  size: SizeClass;
  heightClass: HeightClass;
  isCompact: boolean;
  isLarge: boolean;
  isShort: boolean;
  /** Usable content width — screen padding already subtracted, tablet-capped. */
  content: number;
  /** Scales a design-time number to this screen. Never applied to body text. */
  scale: (value: number) => number;
  /**
   * Side length for the screen's hero graphic — a progress ring, a game board,
   * a letter tile. Shrinks on short screens so the rest of the column still fits.
   */
  hero: number;
};

/** Pure — no React. Tested directly against the device matrix. */
export function computeScreen(width: number, height: number): Screen {
  const size: SizeClass = width < COMPACT_MAX ? 'compact' : width < LARGE_MIN ? 'regular' : 'large';
  const heightClass: HeightClass = height < SHORT_MAX ? 'short' : 'tall';

  const content = Math.min(width - space.lg * 2, MAX_CONTENT);

  const ratio = clamp(width / DESIGN_WIDTH, SCALE_MIN, SCALE_MAX);
  const scale = (value: number) => Math.round(value * ratio);

  // A hero takes most of the content width, but never so much of the column
  // that what sits under it is pushed off a short screen.
  const hero = Math.round(Math.min(content, height * (heightClass === 'short' ? 0.3 : 0.38)));

  return {
    width,
    height,
    size,
    heightClass,
    isCompact: size === 'compact',
    isLarge: size === 'large',
    isShort: heightClass === 'short',
    content,
    scale,
    hero,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Real device sizes the series is checked against. Kept here rather than in the
 * test so app code can reference the same list — and so adding a device that
 * breaks a layout is a one-line change.
 */
export const DEVICE_MATRIX = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'Galaxy A / eski Android', width: 360, height: 640 },
  { name: 'Pixel / orta segment', width: 412, height: 915 },
  { name: 'Galaxy S Ultra', width: 480, height: 1060 },
  { name: 'Pixel Fold (açık)', width: 674, height: 841 },
  { name: 'Tablet 10"', width: 800, height: 1280 },
] as const;
