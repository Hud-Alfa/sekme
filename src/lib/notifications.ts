import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications only — there is no server, so there are no push tokens.
 *
 * Android 13+ requires the POST_NOTIFICATIONS runtime permission; without it a
 * scheduled notification is dropped silently, which is the single easiest way
 * to ship a reminder feature that quietly does nothing.
 */

const DAILY_REMINDER_ID = 'daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Android needs an explicit channel or the notification uses silent defaults. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Hatırlatmalar',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/**
 * Replaces any existing daily reminder. `minutes` is minutes past local midnight.
 * Returns false when permission was refused, so the caller can keep the settings
 * toggle honest instead of showing it as on.
 */
export async function scheduleDailyReminder(
  minutes: number,
  title: string,
  body: string,
): Promise<boolean> {
  const granted = await ensurePermission();
  if (!granted) return false;

  await ensureAndroidChannel();
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(minutes / 60) % 24,
      minute: minutes % 60,
      channelId: 'reminders',
    },
  });

  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {
    // Nothing scheduled under that id — cancelling is idempotent by design.
  });
}
