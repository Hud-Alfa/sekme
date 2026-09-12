import type { TextStyle } from 'react-native';

/**
 * One typographic scale for the whole series. Use at most three steps per screen.
 *
 * `allowFontScaling` is never disabled — layouts must survive the largest system
 * font size. Numbers use tabular figures so counters do not jitter as they change.
 */
export const type = {
  display: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontFamily: 'Nunito_800ExtraBold',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontFamily: 'Nunito_700Bold',
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Nunito_600SemiBold',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Nunito_400Regular',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Nunito_600SemiBold',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontFamily: 'Nunito_500Medium',
  },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Apply to any style holding digits that change in place. */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };
