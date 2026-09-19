/**
 * The difficulty curve, alone in its own file.
 *
 * Balance is tuned HERE and nowhere else. Every constant a designer would want
 * to move lives in this module, so changing how hard the game feels is a
 * numbers edit rather than a rewrite — the same separation `scoring.ts` has in
 * Blok Patlat.
 */

/** Columns across the board. Seven is wide enough to aim into and narrow enough to fill. */
export const COLUMNS = 7;

/** Rows the board is tall. The bottom row is the death line. */
export const ROWS = 9;

/** Balls the player starts with. */
export const STARTING_BALLS = 1;

/** Ball speed, in board cells per second. */
export const SPEED_IN_CELLS = 5.6;

/**
 * Difficulty is a per-run choice, picked on "Yeni oyun" — not a settings
 * toggle, since it shapes a single run's whole curve, not the app.
 *
 * Only two levers move: how tough a block is, and how often a ball pickup
 * shows up. `cellsPerRow` (how much of a row fills) stays the same across all
 * three — thinning it out on `kolay` would make the board feel empty rather
 * than easy, and packing it on `zor` risks the "unplayable" the difficulty
 * was explicitly asked not to become.
 */
export type Difficulty = 'kolay' | 'orta' | 'zor';

export const DEFAULT_DIFFICULTY: Difficulty = 'orta';

/** Multiplies `baseHp` — a harder block, not a taller wall. */
const HP_MULTIPLIER: Record<Difficulty, number> = {
  kolay: 0.7,
  orta: 1,
  zor: 1.35,
};

/**
 * Base hit count for a block spawned on `turn`.
 *
 * Linear alone goes stale, and pure exponential walls the player out around
 * turn 40. The mix rises gently at first and then keeps accelerating, which is
 * what makes turn 80 feel different from turn 20 without a difficulty cliff.
 */
export function baseHp(turn: number, difficulty: Difficulty): number {
  const raw = turn * 1.5 + Math.pow(Math.max(turn, 1), 1.1);
  return Math.max(1, Math.floor(raw * HP_MULTIPLIER[difficulty]));
}

/** Spread around the base, so a row is never one flat wall of equal numbers. */
export const HP_SPREAD = { min: 0.8, max: 1.2 } as const;

/** How many of the seven cells a new row fills, as turn grows. */
export function cellsPerRow(turn: number): { min: number; max: number } {
  if (turn < 5) return { min: 2, max: 3 };
  if (turn < 20) return { min: 3, max: 4 };
  if (turn < 50) return { min: 3, max: 5 };
  return { min: 4, max: 6 };
}

/**
 * Chance a spawned cell is a ball pickup rather than a block.
 *
 * This is the other half of difficulty: `kolay` sees pickups more often,
 * `zor` less — the same "more/less" shape as `HP_MULTIPLIER`, just pointed
 * the other way, since a pickup is relief and a block is pressure.
 */
const BALL_PICKUP_CHANCE: Record<Difficulty, number> = {
  kolay: 0.68,
  orta: 0.55,
  zor: 0.42,
};

export function ballPickupChance(difficulty: Difficulty): number {
  return BALL_PICKUP_CHANCE[difficulty];
}

/**
 * How many balls a pickup is actually worth, as turn grows.
 *
 * This used to be a flat +1 forever, which fell further behind every turn:
 * `baseHp` grows superlinearly and `cellsPerRow` fills more of the board, but
 * a single extra ball at turn 150 clears exactly as little as it did at
 * turn 15. Scaling it is what makes the pickup stay worth aiming for instead
 * of becoming a rounding error.
 */
export function ballAmount(turn: number): number {
  if (turn < 25) return 1;
  if (turn < 60) return 2;
  return turn < 120 ? 3 : 4;
}

/**
 * Chance a row carries gold, and how much.
 *
 * Paced so an average run of 70–100 turns earns roughly one capsule. Gold is
 * only ever earned — there is no way to buy it, and there never will be.
 */
export function goldChance(turn: number): number {
  if (turn < 20) return 0.3;
  if (turn < 50) return 0.45;
  return 0.6;
}

/** Same shape as `ballAmount`: a late-run gold pickup should read as more
 * than an early one, not repeat the same single digit for fifty turns. */
export function goldAmount(turn: number): number {
  if (turn < 25) return 1;
  if (turn < 60) return 2;
  return turn < 120 ? 3 : 5;
}

/** What one capsule costs. */
export const CAPSULE_COST = 100;

/* -------------------------------------------------------------------------- */
/* Anti-stuck                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A ball bouncing flat between two blocks never comes home, and the turn never
 * ends. These are escalating nudges rather than a hard cut, so a legitimately
 * long turn is not punished — it is only hurried.
 */
export const STUCK = {
  /** After this many seconds in flight, add a small angle jitter on each bounce. */
  jitterAfter: 10,
  /** Then double the speed. */
  speedUpAfter: 12,
  /** Then pull everything to the floor and end the turn. */
  forceReturnAfter: 15,
  jitterRadians: 0.09,
} as const;
