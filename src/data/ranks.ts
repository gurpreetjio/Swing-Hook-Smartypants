export interface Rank {
  name: string;
  minXp: number;
  color: string;
  icon: string; // emoji badge
}

export const RANKS: Rank[] = [
  { name: 'Pebble', minXp: 0, color: '#9aa0d0', icon: '🪨' },
  { name: 'Spark', minXp: 150, color: '#ffd166', icon: '✨' },
  { name: 'Bouncer', minXp: 400, color: '#06d6a0', icon: '🏀' },
  { name: 'Slinger', minXp: 800, color: '#4cc9f0', icon: '🪝' },
  { name: 'Acrobat', minXp: 1400, color: '#b388ff', icon: '🤸' },
  { name: 'Comet', minXp: 2200, color: '#4cc9f0', icon: '☄️' },
  { name: 'Meteor', minXp: 3200, color: '#ff7043', icon: '🔥' },
  { name: 'Star', minXp: 4500, color: '#ffd700', icon: '⭐' },
  { name: 'Nova', minXp: 6000, color: '#f72585', icon: '💥' },
  { name: 'Mythic', minXp: 8000, color: '#e040fb', icon: '🌌' },
];

export function rankForXp(xp: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.minXp) r = rank;
  return r;
}

export function nextRank(xp: number): Rank | null {
  for (const rank of RANKS) if (xp < rank.minXp) return rank;
  return null;
}
