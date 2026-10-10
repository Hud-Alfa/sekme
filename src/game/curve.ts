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

/** Ball speed, in board cells per second. Raised 8.2 → 11 (24 Eylül): the
 * shot should feel like a snap, not a stroll. */
export const SPEED_IN_CELLS = 11;

/**
 * A turn accelerates while it runs. The genre this borrows from does the same
 * thing for the same reason: the interesting part of a shot is the first
 * second or two, and everything after that is watching a ball finish an
 * arithmetic problem you already solved. Speeding up keeps a long turn from
 * becoming dead time without taking any control away.
 *
 * This is separate from `STUCK` below, which is a rescue for a ball that is
 * genuinely trapped. This one applies to every turn, including good ones.
 */
export const TURN_SPEEDUP = [
  { after: 1.8, scale: 1.5 },
  { after: 4.5, scale: 2.2 },
] as const;

/**
 * Once the arena is empty there is nothing left for a ball to hit, so the
 * turn is over whatever the balls are still doing — they get pulled home at
 * this multiple of the current speed instead of finishing their arcs.
 */
export const CLEAR_BOARD_RETURN_SCALE = 4.5;

/**
 * How much a sideways drag counts, relative to how far up the finger moved.
 *
 * The aim vector is the raw finger offset from the launch point — on a
 * 7-column board that offset is capped by the board's own width, so a finger
 * near the middle could never reach a wide angle no matter how far it
 * dragged. Boosting the horizontal half of that vector before it is
 * normalised (`clampAim`) is a one-number fix: the same drag now reaches a
 * noticeably wider angle without touching the drag surface or the clamp
 * itself.
 */
export const AIM_HORIZONTAL_BOOST = 1.7;

/**
 * Difficulty is a per-run choice, picked on "Yeni oyun" — not a settings
 * toggle, since it shapes a single run's whole curve, not the app.
 */
export type Difficulty = 'kolay' | 'orta' | 'zor';

export const DEFAULT_DIFFICULTY: Difficulty = 'orta';

/**
 * Multiplies `baseHp` — a harder block, not a taller wall.
 *
 * All three were cut by the same 20% on 24 Eylül (0.55/0.8/1.1 → 0.44/0.64/
 * 0.88): easier across the board while keeping the gap between them — `zor`
 * is still exactly twice `kolay`.
 */
const HP_MULTIPLIER: Record<Difficulty, number> = {
  kolay: 0.44,
  orta: 0.64,
  zor: 0.88,
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

/**
 * The same thing for a triangle. A triangle only occupies half its cell, so
 * it takes fewer hits per pass than a square standing in the same column —
 * an equal number on it reads as tougher than it plays. Its own, lower band
 * keeps it a shape difference rather than an accidental difficulty spike.
 */
export const TRIANGLE_HP_SPREAD = { min: 0.45, max: 0.75 } as const;

/**
 * Chance a spawned block is a triangle (one of the four corner orientations,
 * chosen evenly) instead of a plain square. A ball deflects off a triangle's
 * diagonal at whatever angle that diagonal implies — see `game/physics.ts`'s
 * `hitTriangle` — instead of the flat left/right/up/down a square always
 * gives. Kept independent of difficulty on purpose: it changes the SHAPE of
 * the puzzle, not how hard it is, so all three difficulties see it equally.
 */
export const TRIANGLE_CHANCE = 0.22;

/**
 * How many of the seven cells a new row fills, as turn grows.
 *
 * This used to be the same at every difficulty — only `baseHp` and the
 * pickup chance moved. In practice a packed row is the thing that actually
 * reads as "no room to breathe," regardless of how weak the blocks in it
 * are: `kolay`'s softer blocks still fill nearly every column by turn 50,
 * which looks and plays identically to `zor`. `kolay` now fills visibly
 * fewer cells, `zor` visibly more — the density itself is a difficulty
 * lever now, not just a shared constant the other two levers sit on top of.
 */
function cellsPerRowBase(turn: number): { min: number; max: number } {
  if (turn < 5) return { min: 1, max: 2 };
  if (turn < 20) return { min: 2, max: 3 };
  if (turn < 50) return { min: 2, max: 4 };
  return { min: 3, max: 5 };
}

const CELLS_PER_ROW_OFFSET: Record<Difficulty, number> = {
  kolay: -1,
  orta: 0,
  zor: 1,
};

export function cellsPerRow(turn: number, difficulty: Difficulty): { min: number; max: number } {
  const base = cellsPerRowBase(turn);
  const offset = CELLS_PER_ROW_OFFSET[difficulty];
  return {
    min: Math.max(1, base.min + offset),
    max: Math.max(2, Math.min(COLUMNS - 1, base.max + offset)),
  };
}

/**
 * Chance a spawned cell is a ball pickup rather than a block.
 *
 * This is the other half of difficulty: `kolay` sees pickups more often,
 * `zor` less — the same "more/less" shape as `HP_MULTIPLIER`, just pointed
 * the other way, since a pickup is relief and a block is pressure.
 */
const BALL_PICKUP_CHANCE: Record<Difficulty, number> = {
  kolay: 0.8,
  orta: 0.7,
  zor: 0.6,
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
export function ballAmount(turn: number, difficulty: Difficulty): number {
  let base: number;
  if (turn < 10) base = 1;
  else if (turn < 25) base = 2;
  else if (turn < 50) base = 3;
  else if (turn < 90) base = 4;
  else if (turn < 140) base = 5;
  else base = 6;
  return Math.max(1, Math.round(base * BALL_AMOUNT_BONUS[difficulty]));
}

/**
 * On top of the shared schedule above, the easier the run the more each
 * pickup is worth — the same "relief" direction as `BALL_PICKUP_CHANCE`.
 * `zor` gets the plain schedule, which is itself already richer than the
 * old one (flat +1 until turn 25).
 */
const BALL_AMOUNT_BONUS: Record<Difficulty, number> = {
  kolay: 1.5,
  orta: 1.25,
  zor: 1,
};

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
  jitterAfter: 7,
  /** Then speed everything up by `speedUpScale`. */
  speedUpAfter: 9,
  speedUpScale: 2.5,
  /** Then pull everything to the floor and end the turn. */
  forceReturnAfter: 12,
  jitterRadians: 0.09,
} as const;
