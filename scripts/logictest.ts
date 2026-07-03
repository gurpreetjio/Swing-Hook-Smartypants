/* Logic tests for the pure modules (math generator, level generator, physics).
 * Run: npx tsc -p tsconfig.test.json && node .test-build/scripts/logictest.js
 */
import { generateQuestion } from '../src/math/mathGen';
import { generateLevel } from '../src/game/levelGen';
import { newSim, step } from '../src/game/physics';
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

// ---- level generator ----
for (let grade = 0; grade <= 8; grade++) {
  for (let level = 1; level <= 200; level += 7) {
    const lvl = generateLevel(grade, level);
    assert(lvl.anchors.length >= 6, `g${grade} l${level}: too few anchors`);
    for (let i = 1; i < lvl.anchors.length; i++) {
      assert(lvl.anchors[i].x > lvl.anchors[i - 1].x, `g${grade} l${level}: anchors not increasing`);
    }
    assert(lvl.finishX > lvl.anchors[lvl.anchors.length - 1].x, `g${grade} l${level}: finish before last anchor`);
    const vals = [
      ...lvl.anchors.flatMap((a) => [a.x, a.y]),
      ...lvl.airHazards.flatMap((h) => [h.x, h.y, h.r]),
      lvl.finishX,
    ];
    assert(vals.every(Number.isFinite), `g${grade} l${level}: non-finite geometry`);
  }
}
console.log('levelGen: ok');

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
