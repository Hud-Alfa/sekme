import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  theme: ThemePreference;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  /** Reminder time as minutes past midnight, local. */
  reminderMinutes: number;
  onboardingDone: boolean;

  setTheme: (theme: ThemePreference) => void;
  setHaptics: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setReminderMinutes: (minutes: number) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
};

const defaults = {
  theme: 'system' as ThemePreference,
  hapticsEnabled: true,
  notificationsEnabled: false,
  reminderMinutes: 20 * 60,
  onboardingDone: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setReminderMinutes: (reminderMinutes) => set({ reminderMinutes }),
      completeOnboarding: () => set({ onboardingDone: true }),
      resetAll: () => set({ ...defaults }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => Storage),
    },
  ),
);
