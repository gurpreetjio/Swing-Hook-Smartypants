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
  consumed: Set<number>; // one-shot anchors (red hooks) already used this attempt
  fireX: number; // right edge of the fire cloud chasing from behind
  collected: Set<number>; // trail-bonus pickups already grabbed
  trailOverride: string | null; // temporary trail from a bonus pickup
  trailUntil: number; // when the bonus trail expires
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
    consumed: new Set(),
    fireX: level.startX - WORLD.fireStartOffset,
    collected: new Set(),
    trailOverride: null,
    trailUntil: 0,
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
  sim.consumed.clear();
  sim.fireX = level.startX - WORLD.fireStartOffset;
  sim.collected.clear();
  sim.trailOverride = null;
  sim.trailUntil = 0;
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
    if (sim.consumed.has(i)) continue; // spent red hooks are gone
    const a = level.anchors[i];
    const dx = a.x - sim.x;
    const dy = a.y - sim.y;
    const d = Math.hypot(dx, dy);
    if (dx < -80) continue; // don't hook far behind
    let score: number;
    if (d <= range) {
      score = 1000 + dx - Math.abs(d - range * 0.62) * 0.5;
      // prefer overhead points for plain hooks; special hooks skip that so a
      // red/green hook below or level with you is still easy to grab
      if (mode === 'swing' && dy > 0 && !a.kind) score -= dy * 2;
      if (a.kind) score += 350; // don't let a nearby plain hook steal the tap
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

  // a portal dash flings you flat and gravity-free; hooking is suspended so the
  // horizontal zoom stays clean until the window (or a chained portal) ends
  const dashing = sim.t < sim.dashUntil;

  // hook / release
  if (!dashing && holding && sim.hooked === null) {
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
      // red hooks fling you straight THROUGH the hook to the far side, then
      // vanish. The farther away you grabbed from, the faster the sling.
      if (a.kind === 'red') {
        const dx = a.x - sim.x;
        const dy = a.y - sim.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = Math.min(2200, 640 + dist * 3.4);
        sim.vx = (dx / dist) * speed;
        sim.vy = (dy / dist) * speed;
        sim.consumed.add(idx);
        sim.hooked = null;
      }
    }
  } else if (!holding && sim.hooked !== null) {
    sim.lastHooked = sim.hooked;
    sim.lastReleaseT = sim.t;
    sim.hooked = null;
  }

  // forces — a portal dash cancels gravity and pins you dead horizontal
  if (dashing) {
    sim.vx = Math.max(sim.vx, WORLD.portalSpeed);
    sim.vy = 0;
  } else {
    sim.vy += WORLD.gravity * dt;
  }

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

  // portals: zoom you dead-horizontal to the right for a full second, no
  // gravity. Hitting another portal mid-zoom refreshes the window, so a row of
  // portals chains into one long flat rocket ride.
  for (let i = 0; i < level.portals.length; i++) {
    if (sim.t < sim.portalCdUntil) break;
    const pt = level.portals[i];
    if (Math.hypot(sim.x - pt.x, sim.y - pt.y) < pt.r + WORLD.playerR) {
      sim.vx = WORLD.portalSpeed;
      sim.vy = 0;
      sim.dashUntil = sim.t + 1.0;
      sim.portalCdUntil = sim.t + 0.15; // only stops re-firing the same portal
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

  // trail-bonus pickups: grab one and your trail changes for a while
  if (sim.trailOverride && sim.t > sim.trailUntil) sim.trailOverride = null;
  for (let i = 0; i < level.bonuses.length; i++) {
    if (sim.collected.has(i)) continue;
    const b = level.bonuses[i];
    if (Math.hypot(sim.x - b.x, sim.y - b.y) < 34 + WORLD.playerR) {
      sim.collected.add(i);
      sim.trailOverride = b.trailId;
      sim.trailUntil = sim.t + WORLD.bonusTrailSec;
    }
  }

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

  // trampoline plank floor (absent where planks are missing)
  const overGap = level.floorGaps.some((g) => sim.x > g.x0 && sim.x < g.x1);
  if (sim.y > level.floorY - WORLD.playerR && !overGap) {
    sim.y = level.floorY - WORLD.playerR;
    // trampoline: medium-high boost, never a dead bounce
    if (sim.vy > 0) sim.vy = -Math.max(Math.abs(sim.vy) * 1.02, 620);
    sim.vx *= 0.99;
  } else {
    sim.airtime += dt;
  }

  // fell through a missing plank — but there's a little grace below the floor
  // so you can still fling a rope up and save yourself before it's over
  if (sim.y > level.floorY + WORLD.fallGracePx) {
    sim.status = 'dead';
    return;
  }

  // the fire cloud (Adventure runs only) creeps up from behind; it hurries if
  // it falls too far back, so camping in one spot always ends the same way
  if (level.fire) {
    if (sim.t > WORLD.fireGraceSec) {
      const catchup = Math.max(0, sim.x - sim.fireX - WORLD.fireMaxLagPx) * 0.5;
      sim.fireX += (WORLD.fireSpeed + catchup) * dt;
    }
    if (sim.x < sim.fireX + 20) {
      sim.status = 'dead';
      return;
    }
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

  // fell out the back / stalled behind start
  if (sim.x < -200) {
    sim.status = 'dead';
    return;
  }

  if (sim.x >= level.finishX) {
    sim.status = 'win';
  }
}
