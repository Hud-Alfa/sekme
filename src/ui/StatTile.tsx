import { View } from 'react-native';

import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { space } from '@/ui/tokens';

/**
 * A single number with its label. Three of these in a row is the standard way
 * to show supporting figures under a hero counter.
 */
export function StatTile({
  value,
  label,
  icon,
  tone = 'text',
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
  tone?: 'text' | 'accent' | 'success' | 'warning' | 'danger';
}) {
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ gap: space.xs }}>
        {icon ? <View style={{ marginBottom: space.xs }}>{icon}</View> : null}
        <Text variant="heading" color={tone} numeric numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
    </Card>
  );
}
