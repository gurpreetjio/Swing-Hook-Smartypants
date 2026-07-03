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
  lastHooked: number | null; // for the tap-ratchet: which anchor we just released
  lastReleaseT: number;
  reelBoostUntil: number; // fast reel-in window after a quick re-tap
  dashUntil: number; // portal zoom window: speed cap is lifted
  portalCdUntil: number; // don't re-trigger the same portal instantly
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
    lastHooked: null,
    lastReleaseT: -1e9,
    reelBoostUntil: 0,
    dashUntil: 0,
    portalCdUntil: 0,
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
  sim.lastHooked = null;
  sim.lastReleaseT = -1e9;
  sim.reelBoostUntil = 0;
  sim.dashUntil = 0;
  sim.portalCdUntil = 0;
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
      const d = Math.hypot(a.x - sim.x, a.y - sim.y);
      // attach at the current distance (never shorter — that would teleport the
      // player onto the rope circle); long ropes reel in over time instead
      sim.ropeLen = Math.max(80, d);
      // tap-ratchet: quickly re-tapping the same hook climbs the rope — a fast
      // reel window plus a kick toward the anchor, so rapid taps pull you up
      // much faster than holding
      if (idx === sim.lastHooked && sim.t - sim.lastReleaseT < 0.45 && d > 1) {
        sim.reelBoostUntil = sim.t + 0.32;
        sim.vx += ((a.x - sim.x) / d) * 260;
        sim.vy += ((a.y - sim.y) / d) * 260;
      }
      // red hooks sling you back the way you came from
      if (a.kind === 'red') {
        sim.vx = -sim.vx * 1.15;
        sim.vy *= 0.9;
      }
    }
  } else if (!holding && sim.hooked !== null) {
    sim.lastHooked = sim.hooked;
    sim.lastReleaseT = sim.t;
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
    // energy pump while swinging, like the original's accelerating swings;
    // green hooks turbo-charge the spin
    const pump = level.anchors[sim.hooked].kind === 'green' ? 1.5 : 0.35;
    const boost = 1 + pump * dt;
    sim.vx *= boost;
    sim.vy *= boost;
    // reel-in adds momentum and keeps arcs tight; long ropes (grabbed from far
    // away) reel much faster so the swoop recovers instead of dragging, and the
    // tap-ratchet window reels hardest of all
    const base = sim.t < sim.reelBoostUntil ? 780 : 26;
    const reel = base + Math.max(0, sim.ropeLen - 340) * 1.4;
    sim.ropeLen = Math.max(90, sim.ropeLen - reel * dt);
  }

  // portals: zoom you really fast to the right (Adventure run only)
  for (const pt of level.portals) {
    if (sim.t < sim.portalCdUntil) break;
    if (Math.hypot(sim.x - pt.x, sim.y - pt.y) < pt.r + WORLD.playerR) {
      sim.vx = 2200;
      sim.vy *= 0.3;
      sim.dashUntil = sim.t + 0.55;
      sim.portalCdUntil = sim.t + 0.9;
      sim.hooked = null; // the zoom rips you off the rope
      break;
    }
  }

  const cap = mode === 'swing' ? WORLD.maxSpeed : WORLD.grappleMaxSpeed;
  const sp = Math.hypot(sim.vx, sim.vy);
  if (sp > cap && sim.t >= sim.dashUntil) {
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

  // trampoline floor (deadly where spiked, absent over gaps)
  const overGap = level.floorGaps.some((g) => sim.x > g.x0 && sim.x < g.x1);
  if (sim.y > level.floorY - WORLD.playerR && !overGap) {
    for (const s of level.floorSpikes) {
      if (sim.x >= s.x0 && sim.x <= s.x1) {
        sim.status = 'dead';
        return;
      }
    }
    sim.y = level.floorY - WORLD.playerR;
    // trampoline: medium-high boost, never a dead bounce
    if (sim.vy > 0) sim.vy = -Math.max(Math.abs(sim.vy) * 1.02, 620);
    sim.vx *= 0.99;
  } else {
    sim.airtime += dt;
  }

  // fell into a floor gap — nothing to land on down there
  if (sim.y > level.floorY + 150) {
    sim.status = 'dead';
    return;
  }

  // mid-air bumper planks: reflect the player away with a boost
  for (const p of level.planks) {
    const cx = Math.max(p.x, Math.min(sim.x, p.x + p.w));
    const cy = Math.max(p.y, Math.min(sim.y, p.y + p.h));
    const dx = sim.x - cx;
    const dy = sim.y - cy;
    const d2 = dx * dx + dy * dy;
    const r = WORLD.playerR;
    if (d2 < r * r) {
      let nx: number;
      let ny: number;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = dx / d;
        ny = dy / d;
      } else {
        // center inside the plank: eject toward the nearest horizontal face
        nx = 0;
        ny = sim.y < p.y + p.h / 2 ? -1 : 1;
      }
      sim.x = cx + nx * r;
      sim.y = cy + ny * r;
      const vn = sim.vx * nx + sim.vy * ny;
      if (vn < 0) {
        // reflect with a boost, and guarantee a solid kick away from the plank
        sim.vx -= 2 * vn * nx;
        sim.vy -= 2 * vn * ny;
        const outSpeed = sim.vx * nx + sim.vy * ny;
        if (outSpeed < 560) {
          sim.vx += nx * (560 - outSpeed);
          sim.vy += ny * (560 - outSpeed);
        }
      }
    }
  }

  // spinning/oscillating hazards (sweep vertically or horizontally)
  for (const h of level.airHazards) {
    const osc = h.oscAmp ? Math.sin(sim.t * h.oscSpeed + h.phase) * h.oscAmp : 0;
    const hx = h.x + (h.axis === 'x' ? osc : 0);
    const hy = h.y + (h.axis === 'y' ? osc : 0);
    const d = Math.hypot(sim.x - hx, sim.y - hy);
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
