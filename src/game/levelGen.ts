import { mulberry32, randInt, hashString, Rng } from './rng';

export interface Anchor {
  x: number;
  y: number;
  // adventure-run specials: green speeds up your spin, red slings you backward
  kind?: 'green' | 'red';
}

// Adventure-run portal: touch it and it zooms you fast to the right.
export interface Portal {
  x: number;
  y: number;
  r: number;
}

export interface AirHazard {
  x: number;
  y: number;
  r: number;
  oscAmp: number; // oscillation amplitude (0 = static)
  oscSpeed: number; // radians/sec
  phase: number;
  axis: 'x' | 'y'; // sweep direction (horizontal movers arrive in expert)
}

export interface FloorSpikes {
  x0: number;
  x1: number;
}

// A hole in the floor: nothing to land on — fall in and it's a retry.
export interface FloorGap {
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
  floorGaps: FloorGap[];
  planks: Plank[];
  portals: Portal[];
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
  let ladders = 0;
  for (let i = 0; i < count; i++) {
    x += randInt(rng, p.gap[0], p.gap[1]);
    let y = randInt(rng, p.y[0], p.y[1]);
    // challenge levels: some hooks sit at misleading, extra-low angles
    if (stage === 'challenge' && rng() < 0.25) y = randInt(rng, 330, 430);
    anchors.push({ x, y });
    // hook ladders: an occasional vertical column of hooks (from level 40)
    if (level >= 40 && ladders < 2 && i > 1 && i < count - 2 && rng() < 0.15) {
      ladders++;
      const rungs = randInt(rng, 2, 3);
      for (let rr = 1; rr <= rungs; rr++) {
        const ry = y + rr * randInt(rng, 85, 110);
        if (ry < 520) anchors.push({ x: x + rr * 2, y: ry });
      }
    }
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

  // bumper towers rising from the floor: thread the needle (from level 30)
  if (level >= 30) {
    const n = Math.min(3, 1 + Math.floor((level - 30) / 45));
    for (let i = 0; i < n; i++) {
      const h = randInt(rng, 160, 300 + Math.round(diff * 80));
      planks.push({ x: midBetween(rng) - 13, y: floorY - h, w: 26, h });
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

  // floor gaps — nothing to land on: from advanced levels
  const floorGaps: FloorGap[] = [];
  if (level >= 51) {
    const n = Math.min(4, 1 + Math.floor((level - 51) / 40));
    let attempts = 0;
    while (floorGaps.length < n && attempts++ < 14) {
      const cx = midBetween(rng);
      const w = randInt(rng, 160, 260 + Math.round(diff * 120));
      const x0 = Math.max(700, cx - w / 2);
      const x1 = Math.min(finishX - 250, cx + w / 2);
      if (x1 - x0 > 100 && !floorGaps.some((g) => x0 < g.x1 + 120 && x1 > g.x0 - 120)) {
        floorGaps.push({ x0, x1 });
      }
    }
    floorGaps.sort((a, b) => a.x0 - b.x0);
  }

  // floor spikes ("red zones"): from intermediate on; never inside a gap
  const floorSpikes: FloorSpikes[] = [];
  if (level >= 21) {
    const n = Math.min(5, 1 + Math.floor((level - 21) / 35));
    for (let i = 0; i < n; i++) {
      const a = anchors[randInt(rng, 1, anchors.length - 1)];
      const w = randInt(rng, 120, 200 + Math.round(diff * 120));
      const s = { x0: a.x - w / 2, x1: a.x + w / 2 };
      if (!floorGaps.some((g) => s.x0 < g.x1 && s.x1 > g.x0)) floorSpikes.push(s);
    }
  }

  // moving obstacles: from advanced on, always oscillating; expert levels add
  // horizontal sweepers
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
        axis: level >= 101 && rng() < 0.5 ? 'x' : 'y',
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
    floorGaps,
    planks,
    portals: [],
    stars,
    startX: 60,
    startY: 340,
    finishX,
    floorY,
    ceilY: -80,
  };
}

/**
 * The Adventure run: one enormous endless course scored in meters (10px = 1m).
 * Difficulty ramps with distance. Sprinkled through it: portals that zoom you
 * right, green hooks that turbo-charge your spin, and red hooks that sling you
 * backward. The run ends when you fall — there is no finish line to speak of.
 */
export function generateAdventureLevel(seed: number): Level {
  const rng = mulberry32(seed >>> 0);
  const floorY = 640;
  const anchors: Anchor[] = [];
  const portals: Portal[] = [];
  const planks: Plank[] = [];
  const floorSpikes: FloorSpikes[] = [];
  const floorGaps: FloorGap[] = [];
  const airHazards: AirHazard[] = [];

  const N = 220;
  let x = 380;
  for (let i = 0; i < N; i++) {
    const prog = i / N;
    x += randInt(rng, 175, 250 + Math.round(prog * 110));
    const y = randInt(rng, 60, 180 + Math.round(prog * 220));
    let kind: Anchor['kind'];
    if (i > 5 && rng() < 0.18) kind = 'green';
    else if (i > 10 && rng() < 0.12) kind = 'red';
    anchors.push(kind ? { x, y, kind } : { x, y });

    if (i > 3 && rng() < 0.11) portals.push({ x: x + 95, y: randInt(rng, 160, 420), r: 34 });
    if (i > 6 && rng() < 0.14) {
      const w = randInt(rng, 110, 190);
      planks.push({ x: x + 60, y: randInt(rng, 300, 520), w, h: 22 });
    }
    if (i > 12 && rng() < 0.1) floorSpikes.push({ x0: x - 90, x1: x + 90 });
    if (i > 20 && rng() < 0.08) floorGaps.push({ x0: x + 60, x1: x + 60 + randInt(rng, 160, 320) });
    if (i > 15 && rng() < 0.1) {
      airHazards.push({
        x: x + 120,
        y: randInt(rng, 240, 480),
        r: randInt(rng, 22, 34),
        oscAmp: randInt(rng, 40, 120),
        oscSpeed: 1 + rng() * 2,
        phase: rng() * Math.PI * 2,
        axis: rng() < 0.4 ? 'x' : 'y',
      });
    }
  }

  // tidy overlaps: merge gaps, then drop spikes that fall inside a gap
  floorGaps.sort((a, b) => a.x0 - b.x0);
  const gaps: FloorGap[] = [];
  for (const g of floorGaps) {
    const last = gaps[gaps.length - 1];
    if (last && g.x0 < last.x1 + 120) last.x1 = Math.max(last.x1, g.x1);
    else gaps.push({ ...g });
  }
  const spikes = floorSpikes.filter((s) => !gaps.some((g) => s.x0 < g.x1 && s.x1 > g.x0));

  const finishX = x + 600;
  const stars: Star[] = [];
  for (let i = 0; i < 140; i++) {
    stars.push({ x: rng() * (finishX + 600), y: rng() * floorY * 0.85, r: 1 + rng() * 2, o: 0.25 + rng() * 0.5 });
  }

  return {
    anchors,
    airHazards,
    floorSpikes: spikes,
    floorGaps: gaps,
    planks,
    portals,
    stars,
    startX: 60,
    startY: 340,
    finishX,
    floorY,
    ceilY: -80,
  };
}
