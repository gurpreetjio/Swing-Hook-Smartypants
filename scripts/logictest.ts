/* Logic tests for the pure modules (math generator, level generator, physics).
 * Run: npx tsc -p tsconfig.test.json && node .test-build/scripts/logictest.js
 */
import { generateQuestion } from '../src/math/mathGen';
import { generateAdventureLevel, generateLevel, Level, stageForLevel, themeForLevel, THEMES, WORLD } from '../src/game/levelGen';
import { findAnchor, newSim, respawn, step } from '../src/game/physics';
import { weeklyRotation } from '../src/data/cosmetics';
import { rankForXp, RANKS } from '../src/data/ranks';
import { isoWeekKey, mulberry32 } from '../src/game/rng';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  }
}

// ---- math generator ----
const badTokens = ['NaN', 'undefined', 'Infinity', 'null'];
let checked = 0;
for (let grade = 0; grade <= 8; grade++) {
  for (const level of [1, 24, 25, 26, 60, 100, 149, 150, 200]) {
    for (let seed = 0; seed < 150; seed++) {
      const q = generateQuestion(grade, level, seed * 7919 + grade * 31 + level);
      checked++;
      assert(q.options.length === 4, `g${grade} l${level} s${seed}: expected 4 options, got ${q.options.length} [${q.options}]`);
      assert(new Set(q.options).size === 4, `g${grade} l${level} s${seed}: duplicate options [${q.options}] for "${q.text}"`);
      assert(q.correctIndex >= 0 && q.correctIndex < 4, `g${grade} l${level} s${seed}: bad correctIndex ${q.correctIndex}`);
      assert(q.timeLimitSec >= 8 && q.timeLimitSec <= 20, `g${grade} l${level}: bad time limit ${q.timeLimitSec}`);
      assert(q.fastWindowSec < q.timeLimitSec, `fast window >= limit`);
      for (const o of q.options) {
        assert(!badTokens.some((t) => o.includes(t)), `g${grade} l${level} s${seed}: bad option "${o}" in "${q.text}"`);
      }
      // determinism
      const q2 = generateQuestion(grade, level, seed * 7919 + grade * 31 + level);
      assert(JSON.stringify(q) === JSON.stringify(q2), `g${grade} l${level} s${seed}: not deterministic`);
    }
  }
}
console.log(`math: ${checked} questions checked`);

// spot-check answer correctness on simple "a op b = ?" forms
for (let seed = 0; seed < 2000; seed++) {
  const grade = seed % 9;
  const q = generateQuestion(grade, 1 + (seed % 200), seed);
  const m = q.text.match(/^(-?\d+) ([+−×÷]) (-?\d+|\(-?\d+\)) = \?$/);
  if (!m) continue;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[3].replace(/[()]/g, ''), 10);
  const expected = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
  assert(
    q.options[q.correctIndex] === String(expected),
    `wrong answer for "${q.text}": marked ${q.options[q.correctIndex]}, expected ${expected}`
  );
}

// ---- stages & themes ----
assert(stageForLevel(1) === 'beginner' && stageForLevel(20) === 'beginner', 'beginner range wrong');
assert(stageForLevel(21) === 'intermediate' && stageForLevel(50) === 'intermediate', 'intermediate range wrong');
assert(stageForLevel(51) === 'advanced' && stageForLevel(100) === 'advanced', 'advanced range wrong');
assert(stageForLevel(101) === 'expert' && stageForLevel(200) === 'expert', 'expert range wrong');
assert(stageForLevel(201) === 'challenge' && stageForLevel(9999) === 'challenge', 'challenge range wrong');
assert(THEMES.length === 10 && new Set(THEMES.map((t) => t.name)).size === 10, 'need 10 unique locations');
assert(themeForLevel(1).name !== themeForLevel(21).name, 'world should change every 20 levels');
assert(themeForLevel(1).name === themeForLevel(201).name, 'worlds should loop after 200');

// ---- level generator (including endless challenge levels) ----
for (let grade = 0; grade <= 8; grade++) {
  for (let level = 1; level <= 320; level += 7) {
    const lvl = generateLevel(grade, level);
    assert(lvl.anchors.length >= 6, `g${grade} l${level}: too few anchors`);
    for (let i = 1; i < lvl.anchors.length; i++) {
      assert(lvl.anchors[i].x > lvl.anchors[i - 1].x, `g${grade} l${level}: anchors not increasing`);
    }
    assert(lvl.finishX > lvl.anchors[lvl.anchors.length - 1].x, `g${grade} l${level}: finish before last anchor`);
    const vals = [
      ...lvl.anchors.flatMap((a) => [a.x, a.y]),
      ...lvl.planks.flatMap((p) => [p.x, p.y, p.w, p.h]),
      ...lvl.floorPlanks.flatMap((t) => [t.x0, t.x1]),
      lvl.finishX,
    ];
    assert(vals.every(Number.isFinite), `g${grade} l${level}: non-finite geometry`);
    assert(lvl.fire === false, `g${grade} l${level}: fire outside Adventure mode`);

    const pads = lvl.planks.filter((p) => p.w >= p.h);
    const towers = lvl.planks.filter((p) => p.h > p.w && p.y + p.h >= lvl.floorY - 1);
    const walls = lvl.planks.filter((p) => p.h > p.w && p.y + p.h < lvl.floorY - 1);
    if (level < 8) assert(lvl.planks.length === 0, `g${grade} l${level}: planks before level 8`);
    if (level >= 8) assert(pads.length >= 1, `g${grade} l${level}: no bounce pads`);
    if (level < 30) assert(towers.length === 0, `g${grade} l${level}: floor towers before level 30`);
    if (level >= 30) assert(towers.length >= 1, `g${grade} l${level}: missing floor towers`);
    if (level < 101) assert(walls.length === 0, `g${grade} l${level}: mid-air walls before expert stage`);
    if (level >= 101) assert(walls.length >= 1, `g${grade} l${level}: expert level missing walls`);
    for (const p of lvl.planks) {
      assert(p.y > 200 && p.y < lvl.floorY - 60, `g${grade} l${level}: plank at bad height ${p.y}`);
      assert(p.y + p.h <= lvl.floorY, `g${grade} l${level}: plank reaches below the floor`);
    }

    // ground planks: sorted, non-overlapping, covering the start solidly
    assert(lvl.floorPlanks.length > 5, `g${grade} l${level}: no ground planks`);
    for (let i = 1; i < lvl.floorPlanks.length; i++) {
      assert(lvl.floorPlanks[i].x0 >= lvl.floorPlanks[i - 1].x1 - 1, `g${grade} l${level}: ground planks overlap`);
    }
    assert(lvl.floorPlanks[0].x0 <= -300, `g${grade} l${level}: ground should extend behind the start`);

    // missing planks: none before level 10, guaranteed from 30, never near start
    if (level < 10) assert(lvl.floorGaps.length === 0, `g${grade} l${level}: holes before level 10`);
    if (level >= 30) assert(lvl.floorGaps.length >= 1, `g${grade} l${level}: level 30+ should have missing planks`);
    for (const g of lvl.floorGaps) {
      assert(g.x0 > 600, `g${grade} l${level}: hole too close to start (${Math.round(g.x0)})`);
      assert(g.x1 > g.x0, `g${grade} l${level}: bad hole`);
    }
    for (let i = 1; i < lvl.floorGaps.length; i++) {
      assert(lvl.floorGaps[i].x0 >= lvl.floorGaps[i - 1].x1, `g${grade} l${level}: overlapping holes`);
    }
  }
}
console.log('levelGen: ok');

// ---- regression: a tap must ALWAYS find a hook while any anchor is ahead ----
for (let level = 1; level <= 260; level += 13) {
  for (const mode of ['swing', 'grapple'] as const) {
    const lvl = generateLevel(4, level, mode === 'swing' ? 'adv' : 'grap');
    const lastX = lvl.anchors[lvl.anchors.length - 1].x;
    // probe positions all over the course, including far from any anchor
    for (let px = lvl.startX; px < lastX; px += 137) {
      for (const py of [100, 350, lvl.floorY - 20]) {
        const sim = newSim(lvl);
        sim.x = px;
        sim.y = py;
        const idx = findAnchor(sim, lvl, mode);
        assert(idx !== null, `${mode} l${level}: no hookable anchor from (${px}, ${py})`);
        if (idx !== null) {
          const dx = lvl.anchors[idx].x - px;
          assert(dx >= -80, `${mode} l${level}: hooked an anchor far behind (dx=${Math.round(dx)})`);
        }
      }
    }
  }
}
console.log('findAnchor: always hookable, ok');

// ---- tap-ratchet: rapid tapping must climb the rope faster than holding ----
function reelTest(tapping: boolean): number {
  const lvl = generateLevel(0, 1);
  const a = lvl.anchors[0];
  const sim = newSim(lvl);
  sim.x = a.x - 10;
  sim.y = Math.min(lvl.floorY - 40, a.y + 420);
  sim.vx = 0;
  sim.vy = 0;
  let minD = Infinity;
  const dt = 1 / 120;
  for (let t = 0; t < 2.5 && sim.status === 'alive'; t += dt) {
    const holding = tapping ? t % 0.15 < 0.09 : true; // ~6.7 taps/sec vs constant hold
    step(sim, lvl, 'swing', holding, dt);
    minD = Math.min(minD, Math.hypot(sim.x - a.x, sim.y - a.y));
  }
  return minD;
}
const holdDist = reelTest(false);
const tapDist = reelTest(true);
assert(
  tapDist < holdDist - 80,
  `rapid taps should reel up much faster (tap minDist ${Math.round(tapDist)} vs hold ${Math.round(holdDist)})`
);
console.log(`tap-ratchet: tap climbs to ${Math.round(tapDist)}px vs hold ${Math.round(holdDist)}px — ok`);

// ---- adventure run: endless course with portals and special hooks ----
for (const seed of [12345, 999, 424242]) {
  const alvl = generateAdventureLevel(seed);
  assert(alvl.anchors.length >= 200, `adventure ${seed}: too few anchors`);
  for (let i = 1; i < alvl.anchors.length; i++) {
    assert(alvl.anchors[i].x > alvl.anchors[i - 1].x, `adventure ${seed}: anchors not increasing`);
  }
  assert(alvl.anchors.some((a) => a.kind === 'green'), `adventure ${seed}: no green hooks`);
  assert(alvl.anchors.some((a) => a.kind === 'red'), `adventure ${seed}: no red hooks`);
  assert(alvl.portals.length >= 10, `adventure ${seed}: too few portals (${alvl.portals.length})`);
  assert(alvl.floorGaps.length >= 3, `adventure ${seed}: too few missing planks`);
  assert(alvl.fire === true, `adventure ${seed}: adventure runs must have the fire`);
  for (let i = 1; i < alvl.floorGaps.length; i++) {
    assert(alvl.floorGaps[i].x0 >= alvl.floorGaps[i - 1].x1, `adventure ${seed}: overlapping gaps`);
  }
}
console.log('adventure gen: ok');

// synthetic mini-level for special-hook physics
function makeLevel(anchors: Level['anchors'], portals: Level['portals'] = [], fire = false): Level {
  return {
    anchors,
    portals,
    floorPlanks: [{ x0: -600, x1: 1e9 }],
    floorGaps: [],
    planks: [],
    stars: [],
    startX: 60,
    startY: 340,
    finishX: 1e9,
    floorY: 640,
    ceilY: -80,
    fire,
  };
}

// red hook: slings you the opposite direction, then disappears (one use)
{
  const lvl = makeLevel([{ x: 500, y: 100, kind: 'red' }]);
  const sim = newSim(lvl);
  sim.x = 430;
  sim.y = 300;
  sim.vx = 400;
  sim.vy = 0;
  step(sim, lvl, 'swing', true, 1 / 120);
  assert(sim.vx < 0, `red hook should reverse vx (got ${Math.round(sim.vx)})`);
  assert(sim.hooked === null, 'red hook should never hold the rope');
  assert(sim.consumed.has(0), 'red hook should be consumed after use');
  assert(findAnchor(sim, lvl, 'swing') === null, 'consumed red hook should be unhookable');
  respawn(sim, lvl);
  assert(findAnchor(sim, lvl, 'swing') !== null, 'red hook should come back after a respawn');
}

// green hook: pumps speed faster than a normal hook
{
  const speeds: number[] = [];
  for (const kind of [undefined, 'green' as const]) {
    const lvl = makeLevel([kind ? { x: 500, y: 100, kind } : { x: 500, y: 100 }]);
    const sim = newSim(lvl);
    sim.x = 500;
    sim.y = 350;
    sim.vx = 300;
    sim.vy = 0;
    for (let t = 0; t < 0.5; t += 1 / 120) step(sim, lvl, 'swing', true, 1 / 120);
    speeds.push(Math.hypot(sim.vx, sim.vy));
  }
  assert(speeds[1] > speeds[0] + 80, `green hook should spin faster (green ${Math.round(speeds[1])} vs normal ${Math.round(speeds[0])})`);
}

// portal: zooms you right, past the normal speed cap
{
  const lvl = makeLevel([], [{ x: 800, y: 340, r: 34 }]);
  const sim = newSim(lvl);
  sim.x = 700;
  sim.y = 340;
  sim.vx = 400;
  sim.vy = 0;
  let maxSp = 0;
  for (let t = 0; t < 0.6; t += 1 / 120) {
    step(sim, lvl, 'swing', false, 1 / 120);
    maxSp = Math.max(maxSp, Math.hypot(sim.vx, sim.vy));
  }
  assert(maxSp > WORLD.maxSpeed + 200, `portal should exceed the speed cap (max ${Math.round(maxSp)})`);
}
console.log('special hooks & portals: ok');

// ---- floor gaps are fatal: drop into one and there is nothing to land on ----
{
  const lvl = generateLevel(3, 91);
  assert(lvl.floorGaps.length >= 1, 'level 91 should have a gap');
  const g = lvl.floorGaps[0];
  const sim = newSim(lvl);
  sim.x = (g.x0 + g.x1) / 2;
  sim.y = lvl.floorY - 20;
  sim.vx = 0;
  sim.vy = 300;
  for (let t = 0; t < 2 && sim.status === 'alive'; t += 1 / 120) step(sim, lvl, 'swing', false, 1 / 120);
  assert(sim.status === 'dead', `falling into a floor gap should be fatal (status=${sim.status})`);
}

// ---- the fire (Adventure only) catches campers; Classic levels have none ----
{
  const lvl = makeLevel([{ x: 100000, y: 100 }], [], true); // hooks far away; player just bounces in place
  const sim = newSim(lvl);
  sim.x = 200;
  sim.vx = 0;
  sim.vy = 0;
  let burned = false;
  for (let t = 0; t < 15 && !burned; t += 1 / 120) {
    step(sim, lvl, 'swing', false, 1 / 120);
    if (sim.status === 'dead') burned = true;
  }
  assert(burned, 'camping in place should end in fire');
  assert(sim.t > WORLD.fireGraceSec, 'fire should respect the grace period');
  // and a respawn resets the fire
  respawn(sim, lvl);
  assert(sim.fireX < lvl.startX, 'fire should reset behind the start on respawn');

  // same camper on a Classic level (no fire): perfectly safe
  const calm = makeLevel([{ x: 100000, y: 100 }]);
  const sim2 = newSim(calm);
  sim2.x = 200;
  sim2.vx = 0;
  sim2.vy = 0;
  for (let t = 0; t < 15; t += 1 / 120) step(sim2, calm, 'swing', false, 1 / 120);
  assert(sim2.status === 'alive', 'no fire outside Adventure — camping in Classic is safe');
}

// ---- physics: scripted bot must stay finite; expect forward progress & some wins ----
let wins = 0;
let deaths = 0;
for (let level = 1; level <= 40; level += 3) {
  for (const mode of ['swing', 'grapple'] as const) {
    const lvl = generateLevel(3, level, mode === 'swing' ? 'adv' : 'grap');
    const sim = newSim(lvl);
    const rng = mulberry32(level * 100 + (mode === 'swing' ? 1 : 2));
    let holding = false;
    let switchAt = 0;
    const dt = 1 / 120;
    let maxX = sim.x;
    for (let t = 0; t < 90 && sim.status === 'alive'; t += dt) {
      if (t >= switchAt) {
        holding = !holding;
        switchAt = t + (holding ? 0.5 + rng() * 0.6 : 0.25 + rng() * 0.4);
      }
      step(sim, lvl, mode, holding, dt);
      maxX = Math.max(maxX, sim.x);
      assert(Number.isFinite(sim.x) && Number.isFinite(sim.y) && Number.isFinite(sim.vx) && Number.isFinite(sim.vy),
        `${mode} l${level}: sim went non-finite at t=${t.toFixed(2)}`);
      if (!Number.isFinite(sim.x)) break;
    }
    if (sim.status === 'win') wins++;
    if (sim.status === 'dead') deaths++;
    assert(maxX > lvl.startX + 300, `${mode} l${level}: bot never progressed (maxX=${Math.round(maxX)})`);
  }
}
console.log(`physics bot: ${wins} wins, ${deaths} deaths across 28 runs`);
assert(wins >= 3, `expected a random-ish bot to clear some easy levels, got ${wins}`);

// ---- weekly rotation & ranks & week keys ----
const rot1 = weeklyRotation('2026-W27');
const rot2 = weeklyRotation('2026-W28');
assert(rot1.length === 3 && new Set(rot1.map((s) => s.id)).size === 3, 'rotation not 3 unique skins');
assert(JSON.stringify(rot1) === JSON.stringify(weeklyRotation('2026-W27')), 'rotation not deterministic');
assert(JSON.stringify(rot1) !== JSON.stringify(rot2), 'rotation identical across weeks');

assert(/^\d{4}-W\d{2}$/.test(isoWeekKey(new Date('2026-07-02'))), 'bad week key format');
assert(isoWeekKey(new Date('2026-01-01T12:00:00')) === '2026-W01', `iso week new year: ${isoWeekKey(new Date('2026-01-01T12:00:00'))}`);

assert(rankForXp(0).name === 'Pebble', 'base rank wrong');
assert(rankForXp(999999).name === 'Mythic', 'max rank wrong');
for (let i = 1; i < RANKS.length; i++) assert(RANKS[i].minXp > RANKS[i - 1].minXp, 'ranks not increasing');

if (failures === 0) {
  console.log('ALL LOGIC TESTS PASSED');
} else {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
