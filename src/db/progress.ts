import { getDb } from '@/db';
import { DEFAULT_BALL } from '@/game/balls';
import type { GameState } from '@/game/engine';
import type { Pity } from '@/game/gacha';

/**
 * What survives between launches: the collection, the purse, the best score,
 * and the run in progress.
 */

export type Progress = {
  highScore: number;
  gold: number;
  owned: string[];
  selected: string;
  pity: Pity;
};

export const EMPTY_PROGRESS: Progress = {
  highScore: 0,
  gold: 0,
  owned: [DEFAULT_BALL],
  selected: DEFAULT_BALL,
  pity: { sinceEpic: 0, sinceLegendary: 0 },
};

async function read(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

async function write(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function loadProgress(): Promise<Progress> {
  const raw = await read('progress');
  if (raw === null) return EMPTY_PROGRESS;

  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      ...EMPTY_PROGRESS,
      ...parsed,
      // A corrupt or half-written blob must not cost someone their collection,
      // and it must never leave them with no ball at all.
      owned:
        Array.isArray(parsed.owned) && parsed.owned.length > 0
          ? parsed.owned
          : EMPTY_PROGRESS.owned,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  await write('progress', JSON.stringify(progress));
}

/**
 * The run in progress, so closing the app mid-game is not a loss.
 *
 * A FINISHED run is never stored: reopening into a dead board would be the
 * worst possible first screen, and the same rule already earned its keep in
 * Blok Patlat.
 */
export async function saveRun(state: GameState | null): Promise<void> {
  if (state === null || state.over) {
    const db = await getDb();
    await db.runAsync('DELETE FROM meta WHERE key = ?', 'run');
    return;
  }
  await write('run', JSON.stringify(state));
}

export async function loadRun(): Promise<GameState | null> {
  const raw = await read('run');
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as GameState;
    return parsed.over ? null : parsed;
  } catch {
    return null;
  }
}

export async function recordRun(score: number, gold: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO runs (id, score, gold, ended_at) VALUES (?, ?, ?, ?)',
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    score,
    gold,
    new Date().toISOString(),
  );
}

export async function topRuns(limit = 10): Promise<{ score: number; endedAt: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ score: number; ended_at: string }>(
    'SELECT score, ended_at FROM runs ORDER BY score DESC LIMIT ?',
    limit,
  );
  return rows.map((r) => ({ score: r.score, endedAt: r.ended_at }));
}
