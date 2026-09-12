import * as Haptics from 'expo-haptics';

import { useSettings } from '@/store/settings';

/**
 * Haptics are the series' quiet signature — used sparingly and consistently.
 * Never fire on scroll, list traversal or per-keystroke input.
 *
 * Every call routes through here so the Settings toggle actually silences them.
 */

function enabled(): boolean {
  return useSettings.getState().hapticsEnabled;
}

export const haptic = {
  /** Primary button press. */
  press: () => enabled() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Tab or segment change. */
  select: () => enabled() && Haptics.selectionAsync(),
  /** A real milestone was reached. */
  success: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Rejected input or an invalid move. */
  error: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Confirming something destructive. */
  heavy: () => enabled() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};
