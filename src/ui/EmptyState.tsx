import { View } from 'react-native';

import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { space } from '@/ui/tokens';

/**
 * Every list and every counter needs one of these. An empty screen with no
 * explanation reads as a broken screen.
 */
export function EmptyState({
  illustration,
  title,
  body,
  actionLabel,
  onAction,
}: {
  illustration?: React.ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.md,
        paddingHorizontal: space.xl,
      }}>
      {illustration}
      <Text variant="title" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textMuted" center>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          block={false}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </View>
  );
}
