/**
 * Board themes — cosmetic skins for the play field only (blocks, the aim
 * line, the launcher marker, the ball glow). The rest of the app — headers,
 * buttons, Ayarlar — stays the series' one fixed accent; `tasarim-sistemi`
 * personalises an app with exactly one accent colour, and that rule is about
 * the app's identity across the whole series, not what a single screen's
 * play field is allowed to look like.
 *
 * Unlike balls, a theme is bought outright for gold, not pulled from a
 * capsule — no rarity, no luck, no duplicates. It is deliberately the
 * cheaper, guaranteed alternative: a player who dislikes gacha odds still
 * gets to personalise the one thing they stare at every run.
 *
 * Visual language is lifted from `referans/`: thin glowing outlines instead
 * of a filled square, a single accent hue per theme (or, for `gokkusagi`, one
 * per block) — BBTAN's neon-arcade look, not a redraw of the whole HUD.
 */

export type BoardTheme = {
  id: string;
  name: string;
  /** 0 for the free default. */
  price: number;
  /** Outline/glow colour. Ignored (falls back to the app accent) for `klasik`. */
  accent?: string;
  /** `filled` is the series' normal Card-like block; `outline` is the neon look. */
  style: 'filled' | 'outline';
  /** A soft glow behind outline blocks and balls — off for `klasik`, on for every neon theme. */
  glow: boolean;
  /** `gokkusagi` only: one hue per block instead of one hue for the whole board. */
  palette?: string[];
};

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'klasik', name: 'Klasik', price: 0, style: 'filled', glow: false },
  { id: 'neon-yesil', name: 'Neon Yeşil', price: 50, accent: '#39FF88', style: 'outline', glow: true },
  { id: 'neon-mavi', name: 'Neon Mavi', price: 50, accent: '#3DB8FF', style: 'outline', glow: true },
  { id: 'neon-mor', name: 'Neon Mor', price: 50, accent: '#C86BFF', style: 'outline', glow: true },
  { id: 'neon-altin', name: 'Neon Altın', price: 65, accent: '#FFD166', style: 'outline', glow: true },
  {
    id: 'gokkusagi',
    name: 'Gökkuşağı',
    price: 80,
    accent: '#FF4DA6',
    style: 'outline',
    glow: true,
    palette: ['#3DB8FF', '#FF4DA6', '#FFD166', '#39FF88', '#C86BFF'],
  },
];

export const DEFAULT_BOARD_THEME = 'klasik';

export function findBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]!;
}

/** Picks the theme's colour for a given block index — cycles for `gokkusagi`, fixed otherwise. */
export function themeColorFor(theme: BoardTheme, index: number, fallback: string): string {
  if (theme.palette && theme.palette.length > 0) {
    return theme.palette[index % theme.palette.length]!;
  }
  return theme.accent ?? fallback;
}
