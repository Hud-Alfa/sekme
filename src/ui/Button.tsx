import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { PRESS_SCALE, settle, timing } from '@/ui/motion';
import { Text } from '@/ui/Text';
import { useColors } from '@/ui/theme';
import { duration, HIT_SLOP_MIN, radius, space } from '@/ui/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Fills the available width. Primary actions usually should. */
  block?: boolean;
  left?: React.ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  block = true,
  left,
  style,
  accessibilityHint,
}: ButtonProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const surface: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
  };

  const labelColor =
    variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'onAccent' : 'text';

  const inactive = disabled || loading;

  return (
    <Animated.View style={[animated, block && { alignSelf: 'stretch' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPressIn={() => {
          scale.value = timing(PRESS_SCALE, duration.fast);
        }}
        onPressOut={() => {
          scale.value = settle(1);
        }}
        onPress={() => {
          haptic.press();
          onPress();
        }}
        style={[
          {
            minHeight: HIT_SLOP_MIN + 4,
            borderRadius: radius.md,
            paddingHorizontal: space.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: inactive ? 0.45 : 1,
          },
          surface[variant],
        ]}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
        ) : (
          <>
            {left ? <View>{left}</View> : null}
            <Text variant="label" color={labelColor}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
