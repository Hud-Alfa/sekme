import { type ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/ui/theme';
import { duration, space } from '@/ui/tokens';
import { useScreen } from '@/ui/useScreen';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Off for screens that must not scroll (games, counters). */
  scroll?: boolean;
  /** Remove the standard horizontal padding — for edge-to-edge content. */
  bleed?: boolean;
  /** Pinned to the bottom, outside the scroll area. Use for the primary action. */
  footer?: ReactNode;
  style?: ViewStyle;
};

/**
 * Every screen's frame: safe areas, padding, entrance, and the content width
 * cap that keeps text from stretching across a tablet.
 *
 * Screens should not be built outside this component. One that is must apply
 * `maxWidth` and centring itself — see the `duyarli-tasarim` skill.
 */
export function Screen({ children, scroll = false, bleed = false, footer, style }: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { content } = useScreen();

  // Centred and capped, so a tablet gets a readable column rather than a
  // full-width sprawl. On a phone the cap is never reached and this is a no-op.
  const column: ViewStyle = {
    width: '100%',
    maxWidth: bleed ? undefined : content,
    alignSelf: 'center',
  };

  const padding: ViewStyle = {
    paddingHorizontal: bleed ? 0 : space.lg,
    paddingTop: insets.top + space.sm,
  };

  const body = (
    <Animated.View
      entering={FadeInDown.duration(duration.base).springify()}
      style={[{ flex: scroll ? undefined : 1 }, column, style]}>
      {children}
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[padding, { paddingBottom: space.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>{body}</View>
      )}

      {footer ? (
        <View
          style={{
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}>
          <View style={[column, { paddingHorizontal: space.lg }]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}
