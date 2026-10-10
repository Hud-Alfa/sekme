import { create } from 'zustand';

import * as repo from '@/db/progress';
import { EMPTY_PROGRESS, type Progress } from '@/db/progress';
import { BALLS } from '@/game/balls';
import { CAPSULE_COST, DEFAULT_DIFFICULTY, type Difficulty } from '@/game/curve';
import { initialState, reduce, seededRandom, type GameState, type TurnResult } from '@/game/engine';
import { openCapsule, type Pull } from '@/game/gacha';
import { BOARD_THEMES, findBoardTheme } from '@/game/themes';

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

  // TEMPORARY — test-only, for trying every ball/theme without grinding gold.
  // Remove this and its call site once testing is done, per the user's own
  // "daha sonra kapatacağız".
  debugUnlockAll: () => Promise<void>;
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
    // Sequential, not Promise.all — two calls hitting the same SQLite
    // connection at once is exactly the shape of the NullPointerException
    // this session chased down (see resolveTurn below for the full story).
    const progress = await repo.loadProgress();
    const run = await repo.loadRun();
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

    // Gold banks turn by turn now, not only when a run ends — a player who
    // wants to spend what they just earned should not have to lose the run
    // first to do it. `next.gold` is the run's own running total, so only
    // the DELTA since the last bank needs adding; by the time a run ends,
    // every turn's share has already landed in `progress.gold` one at a
    // time, this is just the last one.
    const goldEarned = next.gold - current.gold;
    const progress = get().progress;
    const bankedProgress: Progress =
      goldEarned > 0 ? { ...progress, gold: progress.gold + goldEarned } : progress;

    if (!next.over) {
      if (goldEarned > 0) set({ progress: bankedProgress });
      // Saved after every turn, so a phone call mid-run costs nothing.
      // Sequential, not Promise.all: two writes racing on the same SQLite
      // connection at once was the actual cause of a
      // `NativeDatabase.prepareAsync` NullPointerException a player hit —
      // banking gold every turn (instead of only at the end of a run, as
      // before) made two concurrent writes a normal thing to happen instead
      // of a rare one. The native binding does not appear to guarantee
      // that two `runAsync` calls issued in the same tick queue safely.
      if (goldEarned > 0) await repo.saveProgress(bankedProgress);
      await repo.saveRun(next);
      return;
    }

    // The run is over: this turn's gold is already folded into
    // bankedProgress above — only the best score and dropping the save
    // remain.
    const finalProgress: Progress = {
      ...bankedProgress,
      highScores: {
        ...bankedProgress.highScores,
        [next.difficulty]: Math.max(bankedProgress.highScores[next.difficulty], next.turn),
      },
    };

    set({ progress: finalProgress });
    // Sequential for the same reason as above.
    await repo.saveProgress(finalProgress);
    await repo.saveRun(null);
    await repo.recordRun(next.turn, next.gold);
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

  debugUnlockAll: async () => {
    const progress = get().progress;
    const next: Progress = {
      ...progress,
      owned: BALLS.map((b) => b.id),
      ownedThemes: BOARD_THEMES.map((t) => t.id),
    };
    set({ progress: next });
    await repo.saveProgress(next);
  },
}));
