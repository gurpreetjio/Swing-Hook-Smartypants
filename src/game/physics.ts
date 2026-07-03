import { Level, WORLD } from './levelGen';

export type GameMode = 'swing' | 'grapple';

export interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hooked: number | null; // anchor index
  ropeLen: number;
  t: number; // level clock (sec)
  retries: number;
  airtime: number; // seconds off the floor while alive (style bonus)
  status: 'alive' | 'dead' | 'win';
}

export function newSim(level: Level): Sim {
  return {
    x: level.startX,
    y: level.startY,
    vx: 260,
    vy: -140,
    hooked: null,
    ropeLen: 0,
    t: 0,
    retries: 0,
    airtime: 0,
    status: 'alive',
  };
}

export function respawn(sim: Sim, level: Level): void {
  sim.x = level.startX;
  sim.y = level.startY;
  sim.vx = 260;
  sim.vy = -140;
  sim.hooked = null;
  sim.status = 'alive';
  sim.retries += 1;
}

/**
 * Choose the anchor to hook. A tap should ALWAYS throw the rope (like the
 * original): prefer the most forward anchor in comfortable range, but if
 * nothing is in range, grab the nearest hook ahead no matter how far — the
 * rope attaches at full length and reels in.
 */
export function findAnchor(sim: Sim, level: Level, mode: GameMode): number | null {
  const range = mode === 'swing' ? WORLD.hookRange : WORLD.grappleRange;
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < level.anchors.length; i++) {
    const a = level.anchors[i];
    const dx = a.x - sim.x;
    const dy = a.y - sim.y;
    const d = Math.hypot(dx, dy);
    if (dx < -80) continue; // don't hook far behind
    let score: number;
    if (d <= range) {
      score = 1000 + dx - Math.abs(d - range * 0.62) * 0.5;
      if (mode === 'swing' && dy > 0) score -= dy * 2; // prefer overhead points
    } else {
      score = -d; // out of range: nearest forward hook wins
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best === -1 ? null : best;
}

/**
 * Advance the simulation one fixed step. `holding` is the touch state.
 * Mutates `sim` (called from a rAF loop; allocation-free on purpose).
 */
export function step(sim: Sim, level: Level, mode: GameMode, holding: boolean, dt: number): void {
  if (sim.status !== 'alive') return;
  sim.t += dt;

  // hook / release
  if (holding && sim.hooked === null) {
    const idx = findAnchor(sim, level, mode);
    if (idx !== null) {
      sim.hooked = idx;
      const a = level.anchors[idx];
      // attach at the current distance (never shorter — that would teleport the
      // player onto the rope circle); long ropes reel in over time instead
      sim.ropeLen = Math.max(80, Math.hypot(a.x - sim.x, a.y - sim.y));
    }
  } else if (!holding && sim.hooked !== null) {
    sim.hooked = null;
  }

  // forces
  sim.vy += WORLD.gravity * dt;

  if (sim.hooked !== null && mode === 'grapple') {
    const a = level.anchors[sim.hooked];
    const dx = a.x - sim.x;
    const dy = a.y - sim.y;
    const d = Math.hypot(dx, dy) || 1;
    // strong pull straight toward the hook — the "pushes you up / straight" feel
    const pull = 5200;
    sim.vx += (dx / d) * pull * dt;
    sim.vy += (dy / d) * pull * dt;
    sim.vx *= 1 - 0.9 * dt;
    sim.vy *= 1 - 0.9 * dt;
  }

  if (sim.hooked !== null && mode === 'swing') {
    // energy pump while swinging, like the original's accelerating swings
    const boost = 1 + 0.35 * dt;
    sim.vx *= boost;
    sim.vy *= boost;
    // reel-in adds momentum and keeps arcs tight; long ropes (grabbed from far
    // away) reel much faster so the swoop recovers instead of dragging
    const reel = 26 + Math.max(0, sim.ropeLen - 340) * 1.4;
    sim.ropeLen = Math.max(90, sim.ropeLen - reel * dt);
  }

  const cap = mode === 'swing' ? WORLD.maxSpeed : WORLD.grappleMaxSpeed;
  const sp = Math.hypot(sim.vx, sim.vy);
  if (sp > cap) {
    sim.vx = (sim.vx / sp) * cap;
    sim.vy = (sim.vy / sp) * cap;
  }

  // integrate
  sim.x += sim.vx * dt;
  sim.y += sim.vy * dt;

  // rope constraint (swing only — grapple is a free pull)
  if (sim.hooked !== null && mode === 'swing') {
    const a = level.anchors[sim.hooked];
    const dx = sim.x - a.x;
    const dy = sim.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > sim.ropeLen) {
      const nx = dx / d;
      const ny = dy / d;
      sim.x = a.x + nx * sim.ropeLen;
      sim.y = a.y + ny * sim.ropeLen;
      const vr = sim.vx * nx + sim.vy * ny;
      if (vr > 0) {
        sim.vx -= vr * nx;
        sim.vy -= vr * ny;
      }
    }
  }

  // ceiling: soft push back down
  if (sim.y < level.ceilY) {
    sim.y = level.ceilY;
    if (sim.vy < 0) sim.vy = -sim.vy * 0.4;
  }

  // trampoline floor (deadly where spiked)
  if (sim.y > level.floorY - WORLD.playerR) {
    for (const s of level.floorSpikes) {
      if (sim.x >= s.x0 && sim.x <= s.x1) {
        sim.status = 'dead';
        return;
      }
    }
    sim.y = level.floorY - WORLD.playerR;
    if (sim.vy > 0) sim.vy = -sim.vy * 0.88;
    if (Math.abs(sim.vy) < 140) sim.vy = -140; // never let the player stall flat
    sim.vx *= 0.985;
  } else {
    sim.airtime += dt;
  }

  // spinning/oscillating hazards
  for (const h of level.airHazards) {
    const hy = h.y + (h.oscAmp ? Math.sin(sim.t * h.oscSpeed + h.phase) * h.oscAmp : 0);
    const d = Math.hypot(sim.x - h.x, sim.y - hy);
    if (d < h.r + WORLD.playerR - 2) {
      sim.status = 'dead';
      return;
    }
  }

  // fell out the back / stalled behind start
  if (sim.x < -200) {
    sim.status = 'dead';
    return;
  }

  if (sim.x >= level.finishX) {
    sim.status = 'win';
  }
}
