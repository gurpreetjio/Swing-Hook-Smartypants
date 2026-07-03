import { mulberry32, randInt, pick, shuffle, Rng } from '../game/rng';

export interface MathQuestion {
  text: string;
  options: string[]; // 4 choices
  correctIndex: number;
  timeLimitSec: number;
  fastWindowSec: number; // answer within this for the speed bonus
}

// band 0..7: which 25-level slice of the 200-level grade the player is in.
export function bandForLevel(level: number): number {
  return Math.min(7, Math.floor((level - 1) / 25));
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  return `${n / g}/${d / g}`;
}

interface Raw {
  text: string;
  answer: string;
  distractors: string[];
}

function numDistractors(rng: Rng, ans: number, spread: number): string[] {
  const set = new Set<number>();
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    const deltas = [1, -1, 2, -2, spread, -spread, spread + 1, 10, -10];
    const d = pick(rng, deltas);
    const v = ans + d;
    if (v !== ans && (ans < 0 || v >= 0 || rng() < 0.3)) set.add(v);
  }
  // Extremely defensive fallback; should never be needed.
  while (set.size < 3) set.add(ans + set.size + 3);
  return [...set].map(String);
}

function q(text: string, ans: number, rng: Rng, spread = 3): Raw {
  return { text, answer: String(ans), distractors: numDistractors(rng, ans, spread) };
}

// Dedupes candidate distractors against the answer and each other, padding with
// simple fraction fillers so we always return exactly 3 unique options.
function fracDistractors(answer: string, candidates: string[]): string[] {
  const out: string[] = [];
  const fillers = ['1/2', '2/3', '3/4', '1/3', '5/8', '7/9'];
  for (const c of [...candidates, ...fillers]) {
    if (c !== answer && !out.includes(c)) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

// ---- per-grade generators; band raises difficulty within the grade ----

function gradeK(rng: Rng, band: number): Raw {
  const max = band < 3 ? 5 : band < 6 ? 10 : 15;
  if (rng() < 0.5) {
    const a = randInt(rng, 1, max);
    const b = randInt(rng, 1, max);
    return q(`${a} + ${b} = ?`, a + b, rng);
  }
  const a = randInt(rng, 2, max);
  const b = randInt(rng, 1, a);
  return q(`${a} − ${b} = ?`, a - b, rng);
}

function grade1(rng: Rng, band: number): Raw {
  const max = 10 + band * 10; // 10 → 80
  if (rng() < 0.55) {
    const a = randInt(rng, 3, max);
    const b = randInt(rng, 2, max);
    return q(`${a} + ${b} = ?`, a + b, rng);
  }
  const a = randInt(rng, 5, max);
  const b = randInt(rng, 1, a);
  return q(`${a} − ${b} = ?`, a - b, rng);
}

function grade2(rng: Rng, band: number): Raw {
  if (band >= 5 && rng() < 0.4) {
    const t = pick(rng, [2, 5, 10] as const);
    const b = randInt(rng, 2, 9);
    return q(`${t} × ${b} = ?`, t * b, rng, t);
  }
  const max = 40 + band * 40; // up to ~320
  if (rng() < 0.5) {
    const a = randInt(rng, 12, max);
    const b = randInt(rng, 11, max);
    return q(`${a} + ${b} = ?`, a + b, rng, 10);
  }
  const a = randInt(rng, 25, max);
  const b = randInt(rng, 11, a - 1);
  return q(`${a} − ${b} = ?`, a - b, rng, 10);
}

function grade3(rng: Rng, band: number): Raw {
  const r = rng();
  const hi = Math.min(12, 5 + band); // times tables grow 5s → 12s
  if (r < 0.4) {
    const a = randInt(rng, 2, hi);
    const b = randInt(rng, 2, hi);
    return q(`${a} × ${b} = ?`, a * b, rng, a);
  }
  if (r < 0.7) {
    const b = randInt(rng, 2, hi);
    const ans = randInt(rng, 2, hi);
    return q(`${b * ans} ÷ ${b} = ?`, ans, rng);
  }
  const max = 200 + band * 100;
  const a = randInt(rng, 50, max);
  const b = randInt(rng, 30, max);
  return rng() < 0.5
    ? q(`${a} + ${b} = ?`, a + b, rng, 10)
    : q(`${Math.max(a, b)} − ${Math.min(a, b)} = ?`, Math.abs(a - b), rng, 10);
}

function grade4(rng: Rng, band: number): Raw {
  const r = rng();
  if (r < 0.35) {
    const a = randInt(rng, 3, 12);
    const b = randInt(rng, 11, 20 + band * 10);
    return q(`${a} × ${b} = ?`, a * b, rng, a);
  }
  if (r < 0.6) {
    const b = randInt(rng, 3, 9);
    const ans = randInt(rng, 5, 20 + band * 5);
    return q(`${b * ans} ÷ ${b} = ?`, ans, rng);
  }
  if (r < 0.8 && band >= 3) {
    const d = pick(rng, [4, 5, 6, 8, 10] as const);
    const n1 = randInt(rng, 1, d - 2);
    const n2 = randInt(rng, 1, d - n1 - 1);
    const ans = frac(n1 + n2, d);
    return {
      text: `${n1}/${d} + ${n2}/${d} = ?`,
      answer: ans,
      distractors: fracDistractors(ans, [frac(Math.min(n1 + n2 + 1, d), d), `${n1 + n2}/${d * 2}`, frac(Math.max(1, n1 + n2 - 1), d)]),
    };
  }
  const a = randInt(rng, 200, 900 + band * 200);
  const b = randInt(rng, 100, 800);
  return q(`${a} + ${b} = ?`, a + b, rng, 100);
}

function grade5(rng: Rng, band: number): Raw {
  const r = rng();
  if (r < 0.35) {
    const a = randInt(rng, 1, 9) + randInt(rng, 1, 9) / 10;
    const b = randInt(rng, 1, 9) + randInt(rng, 1, 9) / 10;
    const ans = Math.round((a + b) * 10) / 10;
    return { text: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`, answer: ans.toFixed(1), distractors: [(ans + 1).toFixed(1), (ans - 0.1).toFixed(1), (ans + 0.1).toFixed(1)] };
  }
  if (r < 0.6) {
    const a = randInt(rng, 12, 25 + band * 10);
    const b = randInt(rng, 12, 30);
    return q(`${a} × ${b} = ?`, a * b, rng, b);
  }
  if (r < 0.8) {
    const pcts = [10, 25, 50] as const;
    const p = pick(rng, pcts);
    const base = randInt(rng, 1, 9) * (p === 25 ? 4 : p === 50 ? 2 : 10) * 2;
    return q(`${p}% of ${base} = ?`, (base * p) / 100, rng);
  }
  const d1 = pick(rng, [2, 3, 4] as const);
  const d2 = pick(rng, [3, 4, 6] as const);
  const ansN = d2 + d1; // 1/d1 + 1/d2 = (d1+d2)/(d1*d2)
  const ans = frac(ansN, d1 * d2);
  return {
    text: `1/${d1} + 1/${d2} = ?`,
    answer: ans,
    distractors: fracDistractors(ans, [frac(2, d1 + d2), frac(1, d1 * d2), frac(ansN + 1, d1 * d2)]),
  };
}

function grade6(rng: Rng, band: number): Raw {
  const r = rng();
  if (r < 0.3) {
    const p = pick(rng, [5, 10, 20, 25, 50, 75] as const);
    const base = randInt(rng, 2, 20) * 20;
    return q(`${p}% of ${base} = ?`, (base * p) / 100, rng, 10);
  }
  if (r < 0.55) {
    const a = randInt(rng, -20 - band * 5, 20 + band * 5);
    const b = randInt(rng, -20, 20);
    return q(`${a} + (${b}) = ?`, a + b, rng);
  }
  if (r < 0.8) {
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    const c = randInt(rng, 2, 9);
    return q(`${a} + ${b} × ${c} = ?`, a + b * c, rng, b);
  }
  const unit = randInt(rng, 2, 12);
  const n = randInt(rng, 3, 9);
  return q(`${n} pencils cost $${n * unit}. Cost of 1?`, unit, rng);
}

function grade7(rng: Rng, band: number): Raw {
  const r = rng();
  if (r < 0.3) {
    const a = randInt(rng, -12, 12) || 3;
    const b = randInt(rng, -12, 12) || -4;
    return q(`${a} × (${b}) = ?`, a * b, rng, Math.abs(a));
  }
  if (r < 0.55) {
    const x = randInt(rng, 2, 12 + band * 2);
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 1, 30);
    return q(`Solve: ${a}x + ${b} = ${a * x + b}`, x, rng);
  }
  if (r < 0.8) {
    const base = pick(rng, [2, 3, 4, 5, 6, 10] as const);
    const exp = base <= 3 ? randInt(rng, 2, 4) : 2;
    return q(`${base}^${exp} = ?`, Math.pow(base, exp), rng, base);
  }
  const p = pick(rng, [15, 30, 40, 60] as const);
  const base = randInt(rng, 2, 15) * 10;
  return q(`${p}% of ${base} = ?`, (base * p) / 100, rng, 5);
}

function grade8(rng: Rng, band: number): Raw {
  const r = rng();
  if (r < 0.3) {
    const x = randInt(rng, -9, 12) || 5;
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, -15, 15);
    return q(`Solve: ${a}x ${b >= 0 ? '+ ' + b : '− ' + -b} = ${a * x + b}`, x, rng);
  }
  if (r < 0.55) {
    const root = randInt(rng, 4, 13 + band);
    return q(`√${root * root} = ?`, root, rng);
  }
  if (r < 0.8) {
    const a = randInt(rng, -8, 8) || 2;
    const b = randInt(rng, -8, 8) || -3;
    const c = randInt(rng, 2, 6);
    return q(`(${a} ${b >= 0 ? '+ ' + b : '− ' + -b}) × ${c} = ?`, (a + b) * c, rng, c);
  }
  const old = randInt(rng, 2, 10) * 10;
  const p = pick(rng, [10, 20, 25, 50] as const);
  return q(`${old} increased by ${p}% = ?`, old + (old * p) / 100, rng, 10);
}

const GENERATORS = [gradeK, grade1, grade2, grade3, grade4, grade5, grade6, grade7, grade8];

export const GRADE_LABELS = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'];

/**
 * Generate a question for a grade (0=K..8) and level (1..200).
 * Pass a seed for deterministic questions (tournaments); omit for random.
 */
export function generateQuestion(grade: number, level: number, seed?: number): MathQuestion {
  const g = Math.max(0, Math.min(8, grade));
  const band = bandForLevel(level);
  const rng = mulberry32(seed !== undefined ? seed : Math.floor(Math.random() * 2 ** 31));
  const raw = GENERATORS[g](rng, band);

  const options = shuffle(rng, [raw.answer, ...raw.distractors.slice(0, 3)]);
  const timeLimitSec = Math.max(8, 10 + band - Math.floor(g / 3));
  return {
    text: raw.text,
    options,
    correctIndex: options.indexOf(raw.answer),
    timeLimitSec,
    fastWindowSec: Math.round(timeLimitSec * 0.35 * 10) / 10,
  };
}
