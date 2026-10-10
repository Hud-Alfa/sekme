import { useRouter } from 'expo-router';

import { BackIcon } from '@/components/space/Icons';
import { tr } from '@/i18n/tr';
import { IconButton, useColors, useScreen } from '@/ui';

/** The standard back button: a drawn chevron instead of a font glyph. */
export function BackButton() {
  const router = useRouter();
  const colors = useColors();
  const { scale } = useScreen();
  return (
    <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
      <BackIcon size={scale(22)} color={colors.text} />
    </IconButton>
  );
}
