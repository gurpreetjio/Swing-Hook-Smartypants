import { mulberry32, randInt, hashString } from './rng';

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

// Striped bumper plank floating mid-level: bounces the player away on contact.
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

/**
 * Deterministic level from (grade, level, mode). Difficulty ramps with level:
 * wider anchor gaps, more height variance, hazards from level 30 (moving from 80),
 * floor spikes from level 15.
 */
export function generateLevel(grade: number, level: number, seedSalt = 'adv'): Level {
  const rng = mulberry32(hashString(`${seedSalt}:${grade}:${level}`));
  const diff = Math.min(1, level / 150); // 0..1 ramp

  const count = Math.min(19, 6 + Math.floor(level / 12));
  const anchors: Anchor[] = [];
  let x = 380;
  for (let i = 0; i < count; i++) {
    const gap = randInt(rng, 170, 230) + Math.round(diff * randInt(rng, 20, 90));
    x += gap;
    const y = randInt(rng, 70, 180 + Math.round(diff * 120));
    anchors.push({ x, y });
  }

  const floorY = 640;
  const finishX = x + 300;

  const airHazards: AirHazard[] = [];
  if (level >= 30) {
    const n = Math.min(6, 1 + Math.floor((level - 30) / 30));
    for (let i = 0; i < n; i++) {
      const between = randInt(rng, 1, anchors.length - 2);
      const a = anchors[between];
      const b = anchors[between + 1];
      airHazards.push({
        x: (a.x + b.x) / 2,
        y: randInt(rng, 260, 480),
        r: randInt(rng, 22, 30 + Math.round(diff * 14)),
        oscAmp: level >= 80 ? randInt(rng, 40, 110) : 0,
        oscSpeed: 1 + rng() * 1.6,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  const floorSpikes: FloorSpikes[] = [];
  if (level >= 15) {
    const n = Math.min(5, 1 + Math.floor((level - 15) / 40));
    for (let i = 0; i < n; i++) {
      const a = anchors[randInt(rng, 1, anchors.length - 1)];
      const w = randInt(rng, 120, 200 + Math.round(diff * 120));
      floorSpikes.push({ x0: a.x - w / 2, x1: a.x + w / 2 });
    }
  }

  // mid-air bumper planks from level 20 — more and bigger as you progress
  const planks: Plank[] = [];
  if (level >= 20) {
    const n = Math.min(6, 1 + Math.floor((level - 20) / 25));
    for (let i = 0; i < n; i++) {
      const between = randInt(rng, 1, anchors.length - 2);
      const a = anchors[between];
      const b = anchors[between + 1];
      const w = randInt(rng, 110, 180 + Math.round(diff * 80));
      planks.push({
        x: (a.x + b.x) / 2 - w / 2 + randInt(rng, -40, 40),
        y: randInt(rng, 280, 500),
        w,
        h: 22,
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
