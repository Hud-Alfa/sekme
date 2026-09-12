import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useColors } from '@/ui/theme';
import { tabularNums, type, type TypeVariant } from '@/ui/type';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  /** Token name, or any explicit colour when a token genuinely does not fit. */
  color?: 'text' | 'textMuted' | 'accent' | 'success' | 'warning' | 'danger' | 'onAccent';
  /** Tabular figures — use for any number that changes in place. */
  numeric?: boolean;
  center?: boolean;
};

export function Text({
  variant = 'body',
  color = 'text',
  numeric,
  center,
  style,
  ...rest
}: TextProps) {
  const colors = useColors();
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        { color: colors[color] },
        numeric && tabularNums,
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
