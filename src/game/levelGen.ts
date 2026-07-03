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

// One ground plank tile. The ground is a row of these; where one is missing
// there's a hole — fall in and you lose.
export interface FloorTile {
  x0: number;
  x1: number;
}

// A hole in the ground where planks are missing.
export interface FloorGap {
  x0: number;
  x1: number;
}

// Striped bumper plank: horizontal ones are bounce pads, vertical ones (h > w)
// are walls/towers that knock you backward. Both reflect the player away.
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
  floorPlanks: FloorTile[];
  floorGaps: FloorGap[];
  planks: Plank[];
  portals: Portal[];
  stars: Star[];
  startX: number;
  startY: number;
  finishX: number;
  floorY: number; // bouncy trampoline plank row
  ceilY: number;
  fire: boolean; // Adventure runs only: the fire cloud chases from behind
}

export const WORLD = {
  gravity: 1950,
  maxSpeed: 1500,
  grappleMaxSpeed: 1700,
  hookRange: 350,
  grappleRange: 430,
  playerR: 14,
  // the fire cloud that chases from behind: camp too long and it catches you
  fireSpeed: 120,
  fireGraceSec: 2.5,
  fireMaxLagPx: 1000, // beyond this the fire speeds up to stay in the chase
  fireStartOffset: 560, // how far behind the start it spawns
};

// ---- stages: the classic difficulty arc ----
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

// Ground planks: wide, thick tiles laid in a row. Some go missing (that's the
// hole you can fall through). The first stretch is always solid.
export const PLANK_TILE = 230;
const SAFE_FLOOR_X = 620;

function buildFloor(
  rng: Rng,
  missChance: number,
  allowDouble: boolean,
  minGaps: number,
  endX: number
): { floorPlanks: FloorTile[]; floorGaps: FloorGap[] } {
  const floorPlanks: FloorTile[] = [];
  const missing: FloorGap[] = [];
  let run = 0; // consecutive missing tiles
  const eligible: number[] = [];
  for (let x = -600; x < endX; x += PLANK_TILE) {
    const canMiss = x > SAFE_FLOOR_X && x < endX - PLANK_TILE * 2 && (run === 0 || (allowDouble && run === 1));
    if (canMiss && rng() < missChance) {
      missing.push({ x0: x, x1: x + PLANK_TILE });
      run += 1;
    } else {
      floorPlanks.push({ x0: x, x1: x + PLANK_TILE });
      if (x > SAFE_FLOOR_X && x < endX - PLANK_TILE * 2) eligible.push(floorPlanks.length - 1);
      run = 0;
    }
  }
  // guarantee the promised number of holes
  while (missing.length < minGaps && eligible.length > 0) {
    const pick = eligible.splice(Math.floor(rng() * eligible.length), 1)[0];
    const tile = floorPlanks[pick];
    missing.push({ x0: tile.x0, x1: tile.x1 });
    floorPlanks[pick] = { x0: NaN, x1: NaN }; // mark for removal
  }
  const planksOut = floorPlanks.filter((t) => Number.isFinite(t.x0));
  // merge adjacent missing tiles into single gaps
  missing.sort((a, b) => a.x0 - b.x0);
  const floorGaps: FloorGap[] = [];
  for (const g of missing) {
    const last = floorGaps[floorGaps.length - 1];
    if (last && g.x0 <= last.x1 + 1) last.x1 = Math.max(last.x1, g.x1);
    else floorGaps.push({ ...g });
  }
  return { floorPlanks: planksOut, floorGaps };
}

/**
 * Deterministic level from (grade, level, mode salt). The stage arc: beginner
 * teaches swing + bounce pads on solid ground; missing floor planks appear
 * from level 10 (guaranteed from 30); towers from 30; hook ladders from 40;
 * walls and far-apart hooks in expert; challenge (201+) runs forever with
 * extreme, misleading hook angles. No instant-kill obstacles — the dangers are
 * holes in the ground and the fire that chases you.
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

  // ground: missing planks appear from level 10, guaranteed from 30,
  // double-wide holes in expert and beyond
  const missChance = level < 10 ? 0 : Math.min(0.18, 0.05 + diff * 0.1);
  const minGaps = level >= 30 ? Math.min(3, 1 + Math.floor(level / 80)) : 0;
  const { floorPlanks, floorGaps } = buildFloor(rng, missChance, level > 120, minGaps, finishX + 400);

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
    floorPlanks,
    floorGaps,
    planks,
    portals: [],
    stars,
    startX: 60,
    startY: 340,
    finishX,
    floorY,
    ceilY: -80,
    fire: false,
  };
}

/**
 * The Adventure run: one enormous endless course scored in meters (10px = 1m).
 * Portals zoom you right, green hooks turbo-charge your spin, red hooks sling
 * you backward. The ground loses more planks the further you go, and the fire
 * is always behind you.
 */
export function generateAdventureLevel(seed: number): Level {
  const rng = mulberry32(seed >>> 0);
  const floorY = 640;
  const anchors: Anchor[] = [];
  const portals: Portal[] = [];
  const planks: Plank[] = [];

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
  }

  const finishX = x + 600;
  const { floorPlanks, floorGaps } = buildFloor(rng, 0.11, true, 4, finishX + 400);

  const stars: Star[] = [];
  for (let i = 0; i < 140; i++) {
    stars.push({ x: rng() * (finishX + 600), y: rng() * floorY * 0.85, r: 1 + rng() * 2, o: 0.25 + rng() * 0.5 });
  }

  return {
    anchors,
    floorPlanks,
    floorGaps,
    planks,
    portals,
    stars,
    startX: 60,
    startY: 340,
    finishX,
    floorY,
    ceilY: -80,
    fire: true,
  };
}
