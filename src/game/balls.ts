/**
 * The ball catalogue.
 *
 * Every ball used to play identically — collecting was for looks only. That
 * changed on purpose: balls now carry real, small, composable effects
 * (`power`), and progress through the collection is progress in the run
 * itself, not just the shelf. See `.claude/CLAUDE.md` for why this is no
 * longer "cosmetic only" and what stayed true anyway (gold is still only
 * ever earned, never bought, so a power is never for sale — only for luck
 * and time).
 */

export type Rarity = 'yaygin' | 'nadir' | 'destansi' | 'efsanevi' | 'mistik';

/**
 * Every field is optional and additive — `undefined`/`0` means "no different
 * than Klasik". Keeping them as small independent numbers (rather than named
 * "abilities") is what lets `GameBoard.tsx` apply all of them with a handful
 * of `?? default` reads instead of a branch per ball.
 */
export type BallPower = {
  /** Extra hit-point damage per touch. 1 is the baseline every ball has. */
  damage?: number;
  /** Multiplies `SPEED_IN_CELLS`. 1 is normal speed. */
  speedMult?: number;
  /** Reach, in cells, for pulling in a ball/gold pickup before actually touching it. */
  magnetRadius?: number;
  /** Chance a block hit does not reflect the ball — it punches through instead. */
  pierceChance?: number;
  /** Chance breaking a block also credits a small bonus gold payout on the spot. */
  luckyGoldChance?: number;
};

export type Ball = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Fill colour. Trails and particles derive from it. */
  color: string;
  /** Length of the motion trail, 0 for none. */
  trail: number;
  power?: BallPower;
};

export const RARITY_ORDER: Rarity[] = ['yaygin', 'nadir', 'destansi', 'efsanevi', 'mistik'];

/** Drop rates, in the order above. They sum to 1. */
export const RARITY_ODDS: Record<Rarity, number> = {
  yaygin: 0.5,
  nadir: 0.3,
  destansi: 0.15,
  efsanevi: 0.045,
  mistik: 0.005,
};

/** Gold returned when a capsule gives a ball that is already owned. */
export const DUPLICATE_REFUND: Record<Rarity, number> = {
  yaygin: 20,
  nadir: 40,
  destansi: 80,
  efsanevi: 250,
  mistik: 1000,
};

export const BALLS: Ball[] = [
  // Yaygın: one clean stat each, easy to feel on the very first capsule.
  {
    id: 'klasik',
    name: 'Klasik',
    rarity: 'yaygin',
    // Was near-white (#F4F4F7) — all but invisible against the light theme's
    // off-white background even with the Dot's ring behind it. A mid slate
    // reads clearly on both the light and dark surface.
    color: '#6B6B76',
    trail: 0,
  },
  { id: 'kiremit', name: 'Kiremit', rarity: 'yaygin', color: '#E4794A', trail: 0, power: { speedMult: 1.06 } },
  { id: 'deniz', name: 'Deniz', rarity: 'yaygin', color: '#4AA3E4', trail: 0, power: { magnetRadius: 0.5 } },

  // Nadir: one stronger single stat.
  { id: 'karpuz', name: 'Karpuz', rarity: 'nadir', color: '#E2455F', trail: 2, power: { damage: 2 } },
  { id: 'kestane', name: 'Kestane', rarity: 'nadir', color: '#8A5A2B', trail: 2, power: { pierceChance: 0.15 } },

  // Destansı: two stats start combining.
  {
    id: 'plazma',
    name: 'Plazma',
    rarity: 'destansi',
    color: '#B14AE4',
    trail: 5,
    power: { speedMult: 1.15, magnetRadius: 0.5 },
  },
  { id: 'yildiz', name: 'Yıldız', rarity: 'destansi', color: '#39D6C0', trail: 5, power: { luckyGoldChance: 0.12 } },

  // Efsanevi: heavier combinations.
  { id: 'alev', name: 'Alev', rarity: 'efsanevi', color: '#FF7A18', trail: 8, power: { damage: 2, speedMult: 1.1 } },
  {
    id: 'karadelik',
    name: 'Kara Delik',
    rarity: 'efsanevi',
    color: '#1B1B24',
    trail: 8,
    power: { magnetRadius: 1.2, pierceChance: 0.1 },
  },

  // Mistik: the whole kit, one ball.
  {
    id: 'goktasi',
    name: 'Göktaşı',
    rarity: 'mistik',
    color: '#FFD166',
    trail: 12,
    power: { damage: 2, speedMult: 1.15, luckyGoldChance: 0.15 },
  },
];

export const DEFAULT_BALL = 'klasik';

export function ballsOfRarity(rarity: Rarity): Ball[] {
  return BALLS.filter((b) => b.rarity === rarity);
}

export type PowerLine = { key: 'damage' | 'speed' | 'magnet' | 'pierce' | 'lucky'; value: number };

/**
 * Turns a ball's `power` into displayable facts, one per active stat — never
 * text. `tr.capsule.power` owns the Turkish phrasing; this only decides WHICH
 * lines apply and what number goes in them, so the wording can change without
 * touching game logic and vice versa.
 */
export function describePower(power: BallPower | undefined): PowerLine[] {
  if (!power) return [];
  const lines: PowerLine[] = [];
  if (power.damage && power.damage > 1) lines.push({ key: 'damage', value: power.damage });
  if (power.speedMult && power.speedMult > 1) {
    lines.push({ key: 'speed', value: Math.round((power.speedMult - 1) * 100) });
  }
  if (power.magnetRadius) lines.push({ key: 'magnet', value: power.magnetRadius });
  if (power.pierceChance) lines.push({ key: 'pierce', value: Math.round(power.pierceChance * 100) });
  if (power.luckyGoldChance) lines.push({ key: 'lucky', value: Math.round(power.luckyGoldChance * 100) });
  return lines;
}

export function findBall(id: string): Ball {
  return BALLS.find((b) => b.id === id) ?? BALLS[0]!;
}
