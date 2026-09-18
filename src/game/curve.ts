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
export const SPEED_IN_CELLS = 3.8;

/**
 * Base hit count for a block spawned on `turn`.
 *
 * Linear alone goes stale, and pure exponential walls the player out around
 * turn 40. The mix rises gently at first and then keeps accelerating, which is
 * what makes turn 80 feel different from turn 20 without a difficulty cliff.
 */
export function baseHp(turn: number): number {
  return Math.floor(turn * 1.5 + Math.pow(Math.max(turn, 1), 1.1));
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

/** Chance a spawned cell is a ball pickup rather than a block. */
export const BALL_PICKUP_CHANCE = 0.55;

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
