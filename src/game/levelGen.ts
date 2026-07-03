import { mulberry32, randInt, hashString, Rng } from './rng';

export interface Anchor {
  x: number;
  y: number;
}

export interface AirHazard {
  x: number;
  y: number;
  r: number;
  oscAmp: number; // vertical oscillation amplitude (0 = static)
  oscSpeed: number; // radians/sec
  phase: number;
}

export interface FloorSpikes {
  x0: number;
  x1: number;
}

// Striped bumper plank: horizontal ones are bounce pads, vertical ones (h > w)
// are walls that knock you backward. Both reflect the player away on contact.
export interface Plank {
  x: number; // top-left
  y: number;
  w: number;
  h: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  o: number; // opacity
}

export interface Level {
  anchors: Anchor[];
  airHazards: AirHazard[];
  floorSpikes: FloorSpikes[];
  planks: Plank[];
  stars: Star[];
  startX: number;
  startY: number;
  finishX: number;
  floorY: number; // bouncy trampoline floor
  ceilY: number;
}

export const WORLD = {
  gravity: 1950,
  maxSpeed: 1500,
  grappleMaxSpeed: 1700,
  hookRange: 350,
  grappleRange: 430,
  playerR: 14,
};

// ---- stages: the classic difficulty arc ----
// 1-20 beginner, 21-50 intermediate, 51-100 advanced, 101-200 expert,
// beyond 200 endless challenge levels with extreme hook placement.
export type Stage = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'challenge';

export function stageForLevel(level: number): Stage {
  if (level <= 20) return 'beginner';
  if (level <= 50) return 'intermediate';
  if (level <= 100) return 'advanced';
  if (level <= 200) return 'expert';
  return 'challenge';
}

export const STAGE_LABELS: Record<Stage, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  challenge: 'Challenge',
};

// ---- 10 themed locations, one per 20 levels, looping forever ----
export interface WorldTheme {
  name: string;
  bg: string;
  floor: string;
  floorBounce: string;
  anchor: string;
}

export const THEMES: WorldTheme[] = [
  { name: 'Neon City', bg: '#0e1030', floor: '#232659', floorBounce: '#3a3f8f', anchor: '#4cc9f0' },
  { name: 'Deep Reef', bg: '#06202e', floor: '#0d3a4a', floorBounce: '#17586e', anchor: '#35e0c2' },
  { name: 'Sunset Dunes', bg: '#2a1226', floor: '#47203c', floorBounce: '#6b3057', anchor: '#ff9e64' },
  { name: 'Jungle Glow', bg: '#0c2418', floor: '#17402a', floorBounce: '#245f3e', anchor: '#8be34d' },
  { name: 'Frost Peaks', bg: '#101c38', floor: '#22335c', floorBounce: '#33497e', anchor: '#9fd8ff' },
  { name: 'Lava Caves', bg: '#200a0e', floor: '#3c1418', floorBounce: '#5c1f24', anchor: '#ff6b4a' },
  { name: 'Candy Clouds', bg: '#251536', floor: '#3d2458', floorBounce: '#573680', anchor: '#ff8fd8' },
  { name: 'Cyber Grid', bg: '#050914', floor: '#101b33', floorBounce: '#1a2b4f', anchor: '#00e5ff' },
  { name: 'Royal Nebula', bg: '#170f38', floor: '#2a1f5e', floorBounce: '#3d2e85', anchor: '#b388ff' },
  { name: 'Golden Temple', bg: '#241a08', floor: '#443311', floorBounce: '#66491a', anchor: '#ffd166' },
];

export function themeForLevel(level: number): WorldTheme {
  return THEMES[Math.floor((level - 1) / 20) % THEMES.length];
}

// per-stage tuning: anchor gaps widen and heights get wilder as stages advance
const STAGE_PARAMS: Record<Stage, { gap: [number, number]; y: [number, number] }> = {
  beginner: { gap: [165, 210], y: [80, 170] },
  intermediate: { gap: [175, 245], y: [70, 230] },
  advanced: { gap: [195, 280], y: [60, 300] },
  expert: { gap: [225, 330], y: [60, 340] },
  challenge: { gap: [245, 360], y: [50, 380] },
};

/**
 * Deterministic level from (grade, level, mode salt), following the classic
 * stage arc: beginner levels teach swing + bounce pads with minimal obstacles;
 * spikes arrive in intermediate, moving obstacles in advanced, walls and
 * far-apart hooks in expert, and challenge levels (201+) run forever with
 * extreme, misleading hook angles.
 */
export function generateLevel(grade: number, level: number, seedSalt = 'adv'): Level {
  const rng = mulberry32(hashString(`${seedSalt}:${grade}:${level}`));
  const stage = stageForLevel(level);
  const p = STAGE_PARAMS[stage];
  const diff = Math.min(1.4, level / 150); // keeps ramping into challenge levels

  const count = Math.min(20, 6 + Math.floor(Math.min(level, 240) / 12));
  const anchors: Anchor[] = [];
  let x = 380;
  for (let i = 0; i < count; i++) {
    x += randInt(rng, p.gap[0], p.gap[1]);
    let y = randInt(rng, p.y[0], p.y[1]);
    // challenge levels: some hooks sit at misleading, extra-low angles
    if (stage === 'challenge' && rng() < 0.25) y = randInt(rng, 330, 430);
    anchors.push({ x, y });
  }

  const floorY = 640;
  const finishX = x + 300;

  const midBetween = (r: Rng) => {
    const i = randInt(r, 1, anchors.length - 2);
    return (anchors[i].x + anchors[i + 1].x) / 2;
  };

  // bounce pads (horizontal planks): part of the game from level 8 onward
  const planks: Plank[] = [];
  if (level >= 8) {
    const maxPads = stage === 'beginner' ? 1 : stage === 'intermediate' ? 3 : stage === 'advanced' ? 4 : 6;
    const n = Math.min(maxPads, 1 + Math.floor((level - 8) / 14));
    for (let i = 0; i < n; i++) {
      const w = randInt(rng, 110, 180 + Math.round(diff * 60));
      // expert+ pads appear unpredictably high or low
      const yRange: [number, number] = stage === 'expert' || stage === 'challenge' ? [240, 540] : [300, 500];
      planks.push({ x: midBetween(rng) - w / 2 + randInt(rng, -40, 40), y: randInt(rng, yRange[0], yRange[1]), w, h: 22 });
    }
  }

  // walls (vertical planks) that kill momentum: expert and challenge stages
  if (level >= 101) {
    const n = stage === 'challenge' ? Math.min(5, 2 + Math.floor((level - 200) / 60)) : Math.min(3, 1 + Math.floor((level - 100) / 50));
    for (let i = 0; i < n; i++) {
      const y = randInt(rng, 230, 360);
      const h = Math.min(randInt(rng, 140, 220), floorY - 40 - y);
      planks.push({ x: midBetween(rng) - 11, y, w: 22, h });
    }
  }

  // floor spikes ("red zones"): from intermediate on
  const floorSpikes: FloorSpikes[] = [];
  if (level >= 21) {
    const n = Math.min(5, 1 + Math.floor((level - 21) / 35));
    for (let i = 0; i < n; i++) {
      const a = anchors[randInt(rng, 1, anchors.length - 1)];
      const w = randInt(rng, 120, 200 + Math.round(diff * 120));
      floorSpikes.push({ x0: a.x - w / 2, x1: a.x + w / 2 });
    }
  }

  // moving obstacles: from advanced on, always oscillating
  const airHazards: AirHazard[] = [];
  if (level >= 51) {
    const n = Math.min(6, 1 + Math.floor((level - 51) / 25));
    for (let i = 0; i < n; i++) {
      airHazards.push({
        x: midBetween(rng),
        y: randInt(rng, 240, 480),
        r: randInt(rng, 22, 30 + Math.round(diff * 12)),
        oscAmp: randInt(rng, 40, 120),
        oscSpeed: 1 + rng() * (1.4 + diff),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  const stars: Star[] = [];
  for (let i = 0; i < 26; i++) {
    stars.push({
      x: rng() * (finishX + 600),
      y: rng() * floorY * 0.85,
      r: 1 + rng() * 2,
      o: 0.25 + rng() * 0.5,
    });
  }

  return {
    anchors,
    airHazards,
    floorSpikes,
    planks,
    stars,
    startX: 60,
    startY: 340,
    finishX,
    floorY,
    ceilY: -80,
  };
}
