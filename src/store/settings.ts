import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  theme: ThemePreference;
  hapticsEnabled: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  onboardingDone: boolean;

  setTheme: (theme: ThemePreference) => void;
  setHaptics: (enabled: boolean) => void;
  setMusic: (enabled: boolean) => void;
  setSfx: (enabled: boolean) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
};

const defaults = {
  theme: 'system' as ThemePreference,
  hapticsEnabled: true,
  // No audio engine wired up yet — these are the switches for when there
  // is one, so the setting exists before the sound does rather than after.
  musicEnabled: true,
  sfxEnabled: true,
  onboardingDone: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setMusic: (musicEnabled) => set({ musicEnabled }),
      setSfx: (sfxEnabled) => set({ sfxEnabled }),
      completeOnboarding: () => set({ onboardingDone: true }),
      resetAll: () => set({ ...defaults }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => Storage),
    },
  ),
);
