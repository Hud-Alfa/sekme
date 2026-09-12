/**
 * The ball catalogue.
 *
 * Every ball plays identically: same radius, same speed, same hit. What differs
 * is how it looks and sounds. That is deliberate and it is the whole economy —
 * progress comes from collecting, never from power, so a player who never opens
 * a capsule is not playing a worse game than one who has.
 */

export type Rarity = 'yaygin' | 'nadir' | 'destansi' | 'efsanevi' | 'mistik';

export type Ball = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Fill colour. Trails and particles derive from it. */
  color: string;
  /** Length of the motion trail, 0 for none. */
  trail: number;
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
  { id: 'klasik', name: 'Klasik', rarity: 'yaygin', color: '#F4F4F7', trail: 0 },
  { id: 'kiremit', name: 'Kiremit', rarity: 'yaygin', color: '#E4794A', trail: 0 },
  { id: 'deniz', name: 'Deniz', rarity: 'yaygin', color: '#4AA3E4', trail: 0 },
  { id: 'limon', name: 'Limon', rarity: 'yaygin', color: '#E4D14A', trail: 0 },

  { id: 'karpuz', name: 'Karpuz', rarity: 'nadir', color: '#E2455F', trail: 2 },
  { id: 'nazar', name: 'Nazar', rarity: 'nadir', color: '#2F6BD8', trail: 2 },
  { id: 'kestane', name: 'Kestane', rarity: 'nadir', color: '#8A5A2B', trail: 2 },

  { id: 'plazma', name: 'Plazma', rarity: 'destansi', color: '#B14AE4', trail: 5 },
  { id: 'yildiz', name: 'Yıldız', rarity: 'destansi', color: '#39D6C0', trail: 5 },

  { id: 'alev', name: 'Alev', rarity: 'efsanevi', color: '#FF7A18', trail: 8 },
  { id: 'karadelik', name: 'Kara Delik', rarity: 'efsanevi', color: '#1B1B24', trail: 8 },

  { id: 'goktasi', name: 'Göktaşı', rarity: 'mistik', color: '#FFD166', trail: 12 },
];

export const DEFAULT_BALL = 'klasik';

export function ballsOfRarity(rarity: Rarity): Ball[] {
  return BALLS.filter((b) => b.rarity === rarity);
}

export function findBall(id: string): Ball {
  return BALLS.find((b) => b.id === id) ?? BALLS[0]!;
}
