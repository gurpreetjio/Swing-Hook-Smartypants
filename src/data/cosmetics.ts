export interface Skin {
  id: string;
  name: string;
  head: string; // head fill
  body: string; // limbs/body stroke
  glow?: string; // special variants get a glow halo
  weekly?: boolean;
}

export interface Rope {
  id: string;
  name: string;
  color: string;
  dash?: string; // svg strokeDasharray for styled ropes
  cost: number;
}

export interface Trail {
  id: string;
  name: string;
  colors: string[]; // cycled along the trail (dot trails)
  emoji?: string[]; // object trails: little followers drawn instead of dots
  cost: number;
}

// 20 classic skins, unlocked in order — one per filled progression bar.
export const CLASSIC_SKINS: Skin[] = [
  { id: 'doodle', name: 'Doodle', head: '#f2f3ff', body: '#f2f3ff' },
  { id: 'ember', name: 'Ember', head: '#ff7043', body: '#ffab91' },
  { id: 'minty', name: 'Minty', head: '#06d6a0', body: '#7ef7d8' },
  { id: 'bolt', name: 'Bolt', head: '#ffd166', body: '#ffe9ad' },
  { id: 'frost', name: 'Frost', head: '#4cc9f0', body: '#b3ecff' },
  { id: 'grape', name: 'Grape', head: '#b388ff', body: '#d7c3ff' },
  { id: 'rosy', name: 'Rosy', head: '#ef476f', body: '#ff9db4' },
  { id: 'limey', name: 'Limey', head: '#b5e655', body: '#dcf5a5' },
  { id: 'coral', name: 'Coral', head: '#ff8fa3', body: '#ffc2cd' },
  { id: 'ocean', name: 'Ocean', head: '#118ab2', body: '#6cc9e8' },
  { id: 'sunny', name: 'Sunny', head: '#ffb703', body: '#ffd97a' },
  { id: 'shadow', name: 'Shadow', head: '#525680', body: '#8d92c4' },
  { id: 'candy', name: 'Candy', head: '#f72585', body: '#ff9dd0' },
  { id: 'kiwi', name: 'Kiwi', head: '#80b918', body: '#c4e37a' },
  { id: 'blaze', name: 'Blaze', head: '#fb5607', body: '#ffa15e' },
  { id: 'royal', name: 'Royal', head: '#3a0ca3', body: '#9d7bff' },
  { id: 'peach', name: 'Peach', head: '#ffb4a2', body: '#ffe0d6' },
  { id: 'storm', name: 'Storm', head: '#6c757d', body: '#c3cad1' },
  { id: 'inferno', name: 'Inferno', head: '#d00000', body: '#ff7b7b' },
  { id: 'galaxy', name: 'Galaxy', head: '#7209b7', body: '#c77dff' },
];

// Fast-answer special variant of a classic skin (same colors + glow).
export function specialVariant(skin: Skin): Skin {
  return { ...skin, id: skin.id + '_x', name: skin.name + ' ✦', glow: skin.head };
}

// Pool of 12 weekly exclusives; 3 rotate in per ISO week.
export const WEEKLY_SKINS: Skin[] = [
  { id: 'w_neon', name: 'Neon Wisp', head: '#39ff14', body: '#b6ffb0', glow: '#39ff14', weekly: true },
  { id: 'w_magma', name: 'Magma Core', head: '#ff3d00', body: '#ffd180', glow: '#ff3d00', weekly: true },
  { id: 'w_ice', name: 'Glacier', head: '#a5f3fc', body: '#e0fbff', glow: '#a5f3fc', weekly: true },
  { id: 'w_void', name: 'Void Walker', head: '#1b1b3a', body: '#7b7fd4', glow: '#7b7fd4', weekly: true },
  { id: 'w_gold', name: 'Gilded', head: '#ffd700', body: '#fff3b0', glow: '#ffd700', weekly: true },
  { id: 'w_pixel', name: 'Pixel Punk', head: '#00e5ff', body: '#ff4081', glow: '#00e5ff', weekly: true },
  { id: 'w_toxic', name: 'Toxic Drip', head: '#aeea00', body: '#76ff03', glow: '#aeea00', weekly: true },
  { id: 'w_rose', name: 'Rose Quartz', head: '#f8bbd0', body: '#fce4ec', glow: '#f8bbd0', weekly: true },
  { id: 'w_cyber', name: 'Cyber Doodle', head: '#e040fb', body: '#80d8ff', glow: '#e040fb', weekly: true },
  { id: 'w_bee', name: 'Buzzer', head: '#ffca28', body: '#212121', glow: '#ffca28', weekly: true },
  { id: 'w_ghost', name: 'Phantom', head: '#eceff1', body: '#b0bec5', glow: '#eceff1', weekly: true },
  { id: 'w_lava', name: 'Obsidian', head: '#263238', body: '#ff6e40', glow: '#ff6e40', weekly: true },
];

export const WEEKLY_SKIN_COST = 250;

export const ROPES: Rope[] = [
  { id: 'r_basic', name: 'Classic Line', color: '#c8cdf5', cost: 0 },
  { id: 'r_gold', name: 'Gold Thread', color: '#ffd166', cost: 100 },
  { id: 'r_vine', name: 'Jungle Vine', color: '#06d6a0', cost: 150 },
  { id: 'r_laser', name: 'Laser Beam', color: '#ff2975', dash: '10,6', cost: 250 },
  { id: 'r_ice', name: 'Frost Wire', color: '#a5f3fc', cost: 200 },
  { id: 'r_royal', name: 'Royal Silk', color: '#b388ff', cost: 200 },
  { id: 'r_ember', name: 'Ember Chain', color: '#ff7043', dash: '4,4', cost: 300 },
  { id: 'r_ghost', name: 'Ghost Strand', color: '#ffffff55', cost: 400 },
];

export const TRAILS: Trail[] = [
  { id: 't_none', name: 'No Trail', colors: [], cost: 0 },
  { id: 't_comet', name: 'Comet', colors: ['#4cc9f0'], cost: 0 },
  { id: 't_rainbow', name: 'Rainbow', colors: ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'], cost: 300 },
  { id: 't_fire', name: 'Fire', colors: ['#ff3d00', '#ffb703'], cost: 200 },
  { id: 't_bubbles', name: 'Bubbles', colors: ['#a5f3fc', '#e0fbff'], cost: 150 },
  { id: 't_sparkle', name: 'Stardust', colors: ['#ffd700', '#ffffff'], cost: 250 },
  { id: 't_toxic', name: 'Toxic', colors: ['#aeea00', '#39ff14'], cost: 200 },
  { id: 't_violet', name: 'Violet Haze', colors: ['#b388ff', '#f72585'], cost: 250 },
  // object trails — a parade of little followers behind the Doodle
  { id: 't_chutes', name: 'Parachute Pals', colors: [], emoji: ['🪂'], cost: 350 },
  { id: 't_balloons', name: 'Balloon Party', colors: [], emoji: ['🎈'], cost: 300 },
  { id: 't_starchain', name: 'Star Chain', colors: [], emoji: ['⭐', '✨'], cost: 250 },
  { id: 't_hearts', name: 'Heart Stream', colors: [], emoji: ['💖', '💜', '💙'], cost: 300 },
  { id: 't_pizza', name: 'Pizza Rain', colors: [], emoji: ['🍕'], cost: 400 },
  { id: 't_ducks', name: 'Duck March', colors: [], emoji: ['🐤'], cost: 350 },
];

export function findSkin(id: string): Skin {
  const all = [...CLASSIC_SKINS, ...CLASSIC_SKINS.map(specialVariant), ...WEEKLY_SKINS];
  return all.find((s) => s.id === id) ?? CLASSIC_SKINS[0];
}

export function findRope(id: string): Rope {
  return ROPES.find((r) => r.id === id) ?? ROPES[0];
}

export function findTrail(id: string): Trail {
  return TRAILS.find((t) => t.id === id) ?? TRAILS[1];
}

// Deterministic weekly rotation: 3 skins per ISO week.
export function weeklyRotation(weekKey: string): Skin[] {
  const week = parseInt(weekKey.split('-W')[1] ?? '1', 10) + parseInt(weekKey.slice(0, 4), 10) * 53;
  const n = WEEKLY_SKINS.length;
  const start = (week * 3) % n;
  return [WEEKLY_SKINS[start], WEEKLY_SKINS[(start + 1) % n], WEEKLY_SKINS[(start + 2) % n]];
}
