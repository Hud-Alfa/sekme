import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useColors, useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';

/**
 * Surfaces read with a soft shadow in light mode — the iOS "grouped card"
 * look — and a hairline border in dark mode: shadows are invisible on dark
 * backgrounds, borders read correctly there instead.
 */
export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.border,
          padding: padded ? space.lg : 0,
          overflow: 'hidden',
        },
        !isDark && {
          boxShadow: `0px 1px 3px ${colors.text}14, 0px 1px 1px ${colors.text}0D`,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
