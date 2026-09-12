import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { Text } from '@/ui/Text';
import { useColors } from '@/ui/theme';
import { HIT_SLOP_MIN, space } from '@/ui/tokens';

/**
 * The standard settings row: leading icon, title (+ optional subtitle),
 * trailing accessory. Rows sharing a Card are separated by a hairline.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  accessory,
  onPress,
  destructive = false,
  last = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accessory?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  const colors = useColors();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT_SLOP_MIN + 8,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      android_ripple={{ color: colors.surfaceAlt }}>
      {content}
    </Pressable>
  );
}
