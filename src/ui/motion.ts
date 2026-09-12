import { Easing, ReduceMotion, withSpring, withTiming } from 'react-native-reanimated';

import { duration } from '@/ui/tokens';

/**
 * Motion exists to explain where things come from — not to decorate.
 *
 * Every helper here respects the OS "reduce motion" setting via
 * `ReduceMotion.System`, which collapses the animation to its end state.
 */

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
} as const;

export const springs = {
  /** Settling a dragged or released element. */
  settle: { damping: 18, stiffness: 180, mass: 1, reduceMotion: ReduceMotion.System },
  /** A livelier bounce, for celebrations only. */
  bouncy: { damping: 11, stiffness: 200, mass: 1, reduceMotion: ReduceMotion.System },
} as const;

export function timing(toValue: number, ms: number = duration.base) {
  'worklet';
  return withTiming(toValue, {
    duration: ms,
    easing: easing.standard,
    reduceMotion: ReduceMotion.System,
  });
}

export function settle(toValue: number) {
  'worklet';
  return withSpring(toValue, springs.settle);
}

/** Stagger delay for list entrances. Caps out so long lists do not crawl in. */
export function staggerDelay(index: number, step = 40, max = 8): number {
  return Math.min(index, max) * step;
}

/** Scale a pressable settles to while held. */
export const PRESS_SCALE = 0.96;
