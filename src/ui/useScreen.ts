import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { computeScreen, type Screen } from '@/ui/screen-math';

/**
 * Screen geometry for components. All the arithmetic lives in `screen-math.ts`,
 * which stays free of React so `npm test` can verify it against the device
 * matrix without a device.
 *
 * See the `duyarli-tasarim` skill for the rules this implements; the short
 * version is that any number which must fit on screen is derived, never
 * written down.
 */
export function useScreen(): Screen {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeScreen(width, height), [width, height]);
}

export {
  COMPACT_MAX,
  DESIGN_WIDTH,
  DEVICE_MATRIX,
  LARGE_MIN,
  MAX_CONTENT,
  SCALE_MAX,
  SCALE_MIN,
  SHORT_MAX,
  computeScreen,
} from '@/ui/screen-math';
export type { HeightClass, Screen, SizeClass } from '@/ui/screen-math';
