import { Pressable, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { PRESS_SCALE, settle, timing } from '@/ui/motion';
import { useColors } from '@/ui/theme';
import { duration, HIT_SLOP_MIN, radius } from '@/ui/tokens';

/**
 * Guarantees the 44x44 minimum touch target regardless of how small the icon is.
 * `accessibilityLabel` is required, not optional — an icon alone says nothing
 * to a screen reader.
 */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  tinted = false,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tinted?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          scale.value = timing(PRESS_SCALE, duration.fast);
        }}
        onPressOut={() => {
          scale.value = settle(1);
        }}
        onPress={() => {
          haptic.select();
          onPress();
        }}
        style={{
          width: HIT_SLOP_MIN,
          height: HIT_SLOP_MIN,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tinted ? colors.surfaceAlt : 'transparent',
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
