import { create } from 'zustand';

import * as repo from '@/db/progress';
import { EMPTY_PROGRESS, type Progress } from '@/db/progress';
import { CAPSULE_COST, DEFAULT_DIFFICULTY, type Difficulty } from '@/game/curve';
import { initialState, reduce, seededRandom, type GameState, type TurnResult } from '@/game/engine';
import { openCapsule, type Pull } from '@/game/gacha';
import { findBoardTheme } from '@/game/themes';

/**
 * Persistence and sequencing. Every rule — what spawns, what breaks, what a
 * capsule gives — comes from `src/game`, which is pure and tested.
 */

type Store = {
  ready: boolean;
  game: GameState | null;
  progress: Progress;
  /** The last capsule opened, for the reveal screen to show. */
  lastPull: Pull | null;

  load: () => Promise<void>;
  newGame: (difficulty?: Difficulty) => Promise<void>;
  resolveTurn: (result: TurnResult) => Promise<void>;

  buyCapsule: () => Promise<Pull | null>;
  selectBall: (id: string) => Promise<void>;
  clearPull: () => void;

  buyTheme: (id: string) => Promise<boolean>;
  selectTheme: (id: string) => Promise<void>;
};

/**
 * A fresh generator per run, seeded from the clock. The engine takes randomness
 * as an argument precisely so tests can pin it; in the app there is nothing to
 * pin it to.
 */
function freshRandom() {
  return seededRandom(Date.now() % 0xffffffff);
}

export const useGame = create<Store>((set, get) => ({
  ready: false,
  game: null,
  progress: EMPTY_PROGRESS,
  lastPull: null,

  load: async () => {
    const [progress, run] = await Promise.all([repo.loadProgress(), repo.loadRun()]);
    set({ ready: true, progress, game: run });
  },

  newGame: async (difficulty = DEFAULT_DIFFICULTY) => {
    const game = initialState(freshRandom(), difficulty);
    set({ game });
    await repo.saveRun(game);
  },

  resolveTurn: async (result) => {
    const current = get().game;
    if (current === null || current.over) return;

    const next = reduce(current, { type: 'resolve-turn', result, random: freshRandom() });
    set({ game: next });

    if (!next.over) {
      // Saved after every turn, so a phone call mid-run costs nothing.
      await repo.saveRun(next);
      return;
    }

    // The run is over: bank the gold, keep the best score for THIS run's
    // difficulty (the other two are untouched), and drop the save.
    const progress = get().progress;
    const banked: Progress = {
      ...progress,
      gold: progress.gold + next.gold,
      highScores: {
        ...progress.highScores,
        [next.difficulty]: Math.max(progress.highScores[next.difficulty], next.turn),
      },
    };

    set({ progress: banked });
    await Promise.all([
      repo.saveProgress(banked),
      repo.saveRun(null),
      repo.recordRun(next.turn, next.gold),
    ]);
  },

  buyCapsule: async () => {
    const progress = get().progress;
    if (progress.gold < CAPSULE_COST) return null;

    const pull = openCapsule(new Set(progress.owned), progress.pity, freshRandom());

    const next: Progress = {
      ...progress,
      gold: progress.gold - CAPSULE_COST + pull.refund,
      owned: pull.duplicate ? progress.owned : [...progress.owned, pull.ball.id],
      pity: pull.pity,
    };

    set({ progress: next, lastPull: pull });
    await repo.saveProgress(next);
    return pull;
  },

  selectBall: async (id) => {
    const progress = get().progress;
    if (!progress.owned.includes(id)) return;

    const next = { ...progress, selected: id };
    set({ progress: next });
    await repo.saveProgress(next);
  },

  clearPull: () => set({ lastPull: null }),

  buyTheme: async (id) => {
    const progress = get().progress;
    if (progress.ownedThemes.includes(id)) return true;

    const theme = findBoardTheme(id);
    if (progress.gold < theme.price) return false;

    const next: Progress = {
      ...progress,
      gold: progress.gold - theme.price,
      ownedThemes: [...progress.ownedThemes, theme.id],
      boardTheme: theme.id,
    };
    set({ progress: next });
    await repo.saveProgress(next);
    return true;
  },

  selectTheme: async (id) => {
    const progress = get().progress;
    if (!progress.ownedThemes.includes(id)) return;

    const next = { ...progress, boardTheme: id };
    set({ progress: next });
    await repo.saveProgress(next);
  },
}));
