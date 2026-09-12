import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { Text, type TextProps } from '@/ui/Text';
import { duration as durations } from '@/ui/tokens';

/**
 * Counts a number up or down instead of snapping to it. Falls back to an
 * instant change when the OS asks for reduced motion.
 */
export function NumberRoll({
  value,
  duration = durations.slow,
  format = (n: number) => String(n),
  ...textProps
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
} & Omit<TextProps, 'children'>) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    let frame: number;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced || duration <= 0) {
        setShown(value);
        return;
      }

      const from = shown;
      const delta = value - from;
      if (delta === 0) return;

      const start = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        // Ease out so the count decelerates into its final value.
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(Math.round(from + delta * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
    // `shown` is deliberately excluded: including it would restart the count on
    // every intermediate frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <Text numeric {...textProps}>
      {format(shown)}
    </Text>
  );
}
