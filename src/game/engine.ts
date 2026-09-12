import { descend, emptyBoard, type Board, type Random } from '@/game/board';
import { STARTING_BALLS } from '@/game/curve';

/**
 * Turn-level game state. `(state, action) => state`, with randomness injected,
 * so a whole run is reproducible and testable without a renderer.
 *
 * What is NOT here: ball positions, velocities, animation. Those live on the UI
 * thread in Reanimated shared values and never round-trip through React. This
 * module only learns the RESULT of a turn — what broke, what was collected —
 * and folds it into the next one.
 */

export type GameState = {
  board: Board;
  /** Turns survived. This is the score the player sees. */
  turn: number;
  balls: number;
  gold: number;
  /** Column the next shot starts from, 0..1 across the board. */
  launchX: number;
  over: boolean;
};

export type TurnResult = {
  /** Points earned from blocks damaged and broken. */
  scored: number;
  ballsCollected: number;
  goldCollected: number;
  /** Where the first returning ball landed, 0..1. */
  launchX: number;
};

export type Action =
  | { type: 'start' }
  | { type: 'resolve-turn'; result: TurnResult; random: Random };

export function initialState(random: Random): GameState {
  const board = emptyBoard();
  // The first row exists before the first shot, so the opening screen has
  // something to aim at rather than an empty field.
  const { board: seeded } = descend(board, 1, random);

  return {
    board: seeded,
    turn: 1,
    balls: STARTING_BALLS,
    gold: 0,
    launchX: 0.5,
    over: false,
  };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'start':
      return state;

    case 'resolve-turn': {
      if (state.over) return state;

      const balls = state.balls + action.result.ballsCollected;
      const gold = state.gold + action.result.goldCollected;
      const turn = state.turn + 1;

      const { board, overflow } = descend(state.board, turn, action.random);

      return {
        board,
        turn,
        balls,
        gold,
        launchX: action.result.launchX,
        over: overflow,
      };
    }

    default:
      return state;
  }
}

/**
 * A deterministic generator, so a seed replays a run exactly. Math.random
 * cannot be seeded, and a test that cannot repeat a failure is not much of a
 * test.
 */
export function seededRandom(seed: number): Random {
  let value = seed >>> 0;
  return () => {
    // xorshift32
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0x100000000;
  };
}
