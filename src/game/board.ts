import {
  BALL_PICKUP_CHANCE,
  COLUMNS,
  HP_SPREAD,
  ROWS,
  ballAmount,
  baseHp,
  cellsPerRow,
  goldAmount,
  goldChance,
} from '@/game/curve';

/**
 * The board: what sits in each cell and how a new row is born.
 *
 * Pure. Randomness is injected as a `() => number`, so a run can be replayed
 * exactly from a seed and `npm test` can assert on a whole simulated game.
 */

export type Cell =
  | { kind: 'empty' }
  | { kind: 'block'; hp: number; maxHp: number }
  | { kind: 'ball'; amount: number }
  | { kind: 'gold'; amount: number };

export type Board = Cell[][];

export type Random = () => number;

export const EMPTY: Cell = { kind: 'empty' };

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLUMNS }, () => EMPTY));
}

function pick(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** A freshly spawned row for the given turn. */
export function spawnRow(turn: number, random: Random): Cell[] {
  const row: Cell[] = Array.from({ length: COLUMNS }, () => EMPTY);

  const { min, max } = cellsPerRow(turn);
  const count = pick(random, min, Math.min(max, COLUMNS));

  const columns = Array.from({ length: COLUMNS }, (_, i) => i);
  // Fisher-Yates, so the filled cells are spread rather than clustered left.
  for (let i = columns.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = columns[i]!;
    columns[i] = columns[j]!;
    columns[j] = a;
  }

  const chosen = columns.slice(0, count);
  const base = baseHp(turn);

  for (const column of chosen) {
    const spread = HP_SPREAD.min + random() * (HP_SPREAD.max - HP_SPREAD.min);
    const hp = Math.max(1, Math.round(base * spread));
    row[column] = { kind: 'block', hp, maxHp: hp };
  }

  // One pickup, in a cell the blocks did not take. Without a steady supply of
  // balls the run stalls; with too many it plays itself.
  const free = columns.slice(count);
  if (free.length > 0 && random() < BALL_PICKUP_CHANCE) {
    row[free[0]!] = { kind: 'ball', amount: ballAmount(turn) };
  }

  if (free.length > 1 && random() < goldChance(turn)) {
    row[free[1]!] = { kind: 'gold', amount: goldAmount(turn) };
  }

  return row;
}

/**
 * Drops everything one row and puts a new row on top.
 *
 * Returns `overflow` when something was pushed past the bottom row — that is
 * the losing condition, decided here rather than by the screen.
 */
export function descend(board: Board, turn: number, random: Random): { board: Board; overflow: boolean } {
  const last = board[board.length - 1] ?? [];
  const overflow = last.some((cell) => cell.kind === 'block');

  const next: Board = [spawnRow(turn, random), ...board.slice(0, ROWS - 1)];

  return { board: next, overflow };
}

/** Reduces a block's hit points. Returns the board and whether it broke. */
export function damage(board: Board, row: number, column: number, amount = 1): {
  board: Board;
  broke: boolean;
  scored: number;
} {
  const cell = board[row]?.[column];
  if (!cell || cell.kind !== 'block') return { board, broke: false, scored: 0 };

  const hp = cell.hp - amount;
  const next = board.map((r) => [...r]);

  if (hp <= 0) {
    next[row]![column] = EMPTY;
    // A tough block is worth more than a soft one, so clearing a wall pays.
    return { board: next, broke: true, scored: cell.maxHp };
  }

  next[row]![column] = { kind: 'block', hp, maxHp: cell.maxHp };
  return { board: next, broke: false, scored: 1 };
}

/** Clears a pickup cell once collected. */
export function clearCell(board: Board, row: number, column: number): Board {
  const next = board.map((r) => [...r]);
  next[row]![column] = EMPTY;
  return next;
}

export function countBlocks(board: Board): number {
  return board.reduce(
    (sum, row) => sum + row.filter((cell) => cell.kind === 'block').length,
    0,
  );
}
