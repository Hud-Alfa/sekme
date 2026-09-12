import {
  BALLS,
  DUPLICATE_REFUND,
  RARITY_ODDS,
  RARITY_ORDER,
  ballsOfRarity,
  type Ball,
  type Rarity,
} from '@/game/balls';
import type { Random } from '@/game/board';

/**
 * The capsule machine.
 *
 * Gold is earned in play and cannot be bought — there is no billing in this
 * series and there will not be one. That removes the usual reason to be
 * stingy, so the pity rules here are generous on purpose: a run of bad luck
 * should cost patience, never money.
 */

/** After this many capsules with nothing epic or better, the next one is. */
export const SOFT_PITY = 10;
/** After this many with nothing legendary or better, the next one is. */
export const HARD_PITY = 50;

export type Pity = {
  /** Capsules opened since the last epic-or-better. */
  sinceEpic: number;
  /** Capsules opened since the last legendary-or-better. */
  sinceLegendary: number;
};

export type Pull = {
  ball: Ball;
  /** True when the player already owned it. */
  duplicate: boolean;
  /** Gold handed back for a duplicate; 0 otherwise. */
  refund: number;
  pity: Pity;
  /** Which rule decided the rarity, for the reveal animation to lean on. */
  reason: 'chance' | 'soft-pity' | 'hard-pity';
};

function rollRarity(random: Random): Rarity {
  let roll = random();
  for (const rarity of RARITY_ORDER) {
    roll -= RARITY_ODDS[rarity];
    if (roll <= 0) return rarity;
  }
  return 'yaygin';
}

function atLeast(rarity: Rarity, floor: Rarity): boolean {
  return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(floor);
}

/** Picks one rarity's ball, preferring something the player does not own yet. */
function chooseBall(rarity: Rarity, owned: ReadonlySet<string>, random: Random): Ball {
  const pool = ballsOfRarity(rarity);
  const fresh = pool.filter((b) => !owned.has(b.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)] ?? BALLS[0]!;
}

export function openCapsule(owned: ReadonlySet<string>, pity: Pity, random: Random): Pull {
  let reason: Pull['reason'] = 'chance';
  let rarity = rollRarity(random);

  if (pity.sinceLegendary + 1 >= HARD_PITY && !atLeast(rarity, 'efsanevi')) {
    rarity = 'efsanevi';
    reason = 'hard-pity';
  } else if (pity.sinceEpic + 1 >= SOFT_PITY && !atLeast(rarity, 'destansi')) {
    rarity = 'destansi';
    reason = 'soft-pity';
  }

  const ball = chooseBall(rarity, owned, random);
  const duplicate = owned.has(ball.id);

  return {
    ball,
    duplicate,
    refund: duplicate ? DUPLICATE_REFUND[ball.rarity] : 0,
    pity: {
      sinceEpic: atLeast(rarity, 'destansi') ? 0 : pity.sinceEpic + 1,
      sinceLegendary: atLeast(rarity, 'efsanevi') ? 0 : pity.sinceLegendary + 1,
    },
    reason,
  };
}
