import { type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/ui/Text';
import { useColors } from '@/ui/theme';
import { duration, radius, space } from '@/ui/tokens';

/**
 * Bottom sheet for a focused sub-task. Tapping the scrim or the hardware back
 * button dismisses it — Play Store rejects apps where back behaves unexpectedly.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(duration.fast)}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <Animated.View
          entering={SlideInDown.duration(duration.base).springify().damping(20)}
          exiting={SlideOutDown.duration(duration.fast)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.lg,
            gap: space.lg,
          }}>
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
            }}
          />
          {title ? <Text variant="title">{title}</Text> : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
