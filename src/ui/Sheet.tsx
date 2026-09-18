import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { settle } from '@/ui/motion';
import { Text } from '@/ui/Text';
import { useColors } from '@/ui/theme';
import { duration, radius, space } from '@/ui/tokens';

/** How far (or how fast) a downward drag must go before it counts as a dismiss. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

/**
 * Bottom sheet for a focused sub-task. Tapping the scrim, pressing the
 * hardware back button, or dragging the handle down all dismiss it — Play
 * Store rejects apps where back behaves unexpectedly, so every path stays
 * available and they all end up calling the same `onClose`.
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
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);

  // The sheet's own visual node stays mounted while `visible` toggles the
  // Modal's native view — reset any leftover drag offset from the last time
  // it was dismissed, or the next open would render it part-way off-screen.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const drag = Gesture.Pan()
    .activeOffsetY(10)
    .onUpdate((event) => {
      // Downward drag follows the finger; upward drag is heavily resisted —
      // the sheet is not meant to grow, only to leave.
      translateY.value = event.translationY > 0 ? event.translationY : event.translationY / 4;
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(screenHeight, { duration: duration.fast }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = settle(0);
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.lg,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.lg,
              gap: space.lg,
            },
            dragStyle,
          ]}>
          <GestureDetector gesture={drag}>
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Kapatmak için aşağı sürükle"
              style={{
                alignSelf: 'center',
                paddingVertical: space.md,
                marginVertical: -space.md,
              }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: colors.border,
                }}
              />
            </View>
          </GestureDetector>
          {title ? <Text variant="title">{title}</Text> : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
