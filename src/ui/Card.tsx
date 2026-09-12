import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useColors } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';

/**
 * Surfaces are separated by a hairline border rather than a shadow — shadows
 * are invisible on dark backgrounds, borders read correctly in both themes.
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
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? space.lg : 0,
          overflow: 'hidden',
        },
        style,
      ]}>
      {children}
    </View>
  );
}
