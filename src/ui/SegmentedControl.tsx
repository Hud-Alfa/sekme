import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { Text } from '@/ui/Text';
import { useColors } from '@/ui/theme';
import { HIT_SLOP_MIN, radius, space } from '@/ui/tokens';

export type Segment<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        padding: space.xs,
        gap: space.xs,
      }}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptic.select();
              onChange(segment.value);
            }}
            style={{
              flex: 1,
              minHeight: HIT_SLOP_MIN - space.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}>
            <Text variant="label" color={selected ? 'text' : 'textMuted'}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
