import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings, type ThemePreference } from '@/store/settings';
import { palette, type Colors, type ColorScheme } from '@/ui/tokens';

type ThemeValue = {
  colors: Colors;
  scheme: ColorScheme;
  preference: ThemePreference;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useSettings((s) => s.theme);

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme =
      preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return { colors: palette[scheme], scheme, preference };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

/** Shorthand for the common case of only needing colours. */
export function useColors(): Colors {
  return useTheme().colors;
}
