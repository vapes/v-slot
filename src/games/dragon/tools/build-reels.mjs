/**
 * Reel strip builder + exact base-game math report, for every math profile.
 *
 * Profiles: "real" = top-level `reelComposition` / `respin.composition`,
 * "demo" = `demo.reelComposition` / `demo.respin.composition` (falls back to
 * real). Builds deterministic strips (seeded shuffle that avoids identical
 * neighbours) into ../strips.json (generated — do not edit by hand), then
 * enumerates EVERY base stop combination per profile for the exact base RTP.
 * The respin feature is measured by `npm run dragon:sim -- <mode>`.
 *
 * Usage:  npm run dragon:reels                (build strips + report)
 *         npm run dragon:reels -- --report    (report only, keep strips)
 *         npm run dragon:reels -- --strips-only (build strips, skip the slow exact base report)
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(DIR, '../config.json');
const STRIPS_PATH = resolve(DIR, '../strips.json');
const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const reportOnly = process.argv.includes('--report');
const stripsOnly = process.argv.includes('--strips-only');

// ── Strip building ────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Composition counts are blocks; `reelStacks` gives the block height per symbol.
 * Constructive seeded draw: each block is picked weighted by what is left,
 * never equal to the previous one (and the strip must not repeat across the wrap).
 */
function buildStrip(composition, seed) {
  const rnd = mulberry32(seed);
  const stacks = cfg.reelStacks ?? {};
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const left = { ...composition };
    let total = Object.values(left).reduce((a, b) => a + b, 0);
    const out = [];
    while (total > 0) {
      const prev = out[out.length - 1];
      const cands = Object.entries(left).filter(([s, n]) => n > 0 && s !== prev);
      if (cands.length === 0) break;
      const top = cands.reduce((a, b) => (b[1] > a[1] ? b : a));
      let pick = top[0];
      if (top[1] * 2 < total) {
        let r = rnd() * cands.reduce((a, [, n]) => a + n, 0);
        for (const [s, n] of cands) { r -= n; if (r < 0) { pick = s; break; } }
      }
      out.push(pick); left[pick]--; total--;
    }
    if (total === 0 && out[0] !== out[out.length - 1]) {
      return out.flatMap(s => Array(stacks[s] ?? 1).fill(s));
    }
  }
  throw new Error('Could not build strip without identical neighbours');
}

const PROFILES = {
  real: { base: cfg.reelComposition, nest: cfg.respin.composition },
  demo: { base: cfg.demo?.reelComposition ?? cfg.reelComposition, nest: cfg.demo?.respin?.composition ?? cfg.respin.composition },
};

let strips;
if (reportOnly) {
  strips = JSON.parse(readFileSync(STRIPS_PATH, 'utf8'));
} else {
  strips = {};
  for (const [mode, p] of Object.entries(PROFILES)) {
    const seed = mode === 'real' ? 0 : 500;
    strips[mode] = {
      reels: p.base.map((comp, i) => buildStrip(comp, 1000 + seed + i)),
      nest: p.nest.map((comp, i) => buildStrip(comp, 2000 + seed + i)),
    };
    console.log(`${mode}: base ${strips[mode].reels.map(r => r.length).join('/')}  nest ${strips[mode].nest.map(r => r.length).join('/')}`);
  }
  const rows = (arr) => arr.map(r => '      ' + JSON.stringify(r)).join(',\n');
  const body = Object.entries(strips).map(([m, s]) =>
    `  "${m}": {\n    "reels": [\n${rows(s.reels)}\n    ],\n    "nest": [\n${rows(s.nest)}\n    ]\n  }`).join(',\n');
  writeFileSync(STRIPS_PATH, `{\n${body}\n}\n`);
  console.log('Written', STRIPS_PATH);
}

if (stripsOnly) process.exit(0);

// ── Exact evaluation ──────────────────────────────────────────────────────────
const WILD = cfg.wild;
const ROWS = cfg.grid.rows;
const LINES = cfg.paylines;
const pay = (s, n) => cfg.paytable[s]?.[String(n)] ?? 0;

function lineWin(cols, line) {
  let sym = null;
  let n = 0;
  for (let r = 0; r < cols.length; r++) {
    const s = cols[r][line[r]];
    if (sym === null && s !== WILD) sym = s;
    if (s === WILD || s === sym) n++; else break;
  }
  return sym === null ? 0 : pay(sym, n);
}

const buckets = [[0, 0], [0.0001, 1], [1, 2], [2, 5], [5, 20], [20, 50], [50, Infinity]];

/** Exact base-game report: every stop combination of the 4 base strips. */
function report(mode, reels) {
  const [L0, L1, L2, L3] = reels.map(r => r.length);
  const windowAt = (strip, stop) => Array.from({ length: ROWS }, (_, k) => strip[(stop + k) % strip.length]);
  const [win0, win1, win2, win3] = reels.map(strip => strip.map((_, i) => windowAt(strip, i)));
  const counts = new Array(buckets.length).fill(0);
  let total = 0, hits = 0, maxWin = 0, sumSq = 0;
  const nLines = LINES.length;

  for (let a = 0; a < L0; a++) for (let b = 0; b < L1; b++) for (let c = 0; c < L2; c++) for (let d = 0; d < L3; d++) {
    const cols = [win0[a], win1[b], win2[c], win3[d]];
    let w = 0;
    for (const line of LINES) w += lineWin(cols, line);
    const x = w / nLines; // win in total bets
    total += x; sumSq += x * x;
    if (w > 0) hits++;
    if (x > maxWin) maxWin = x;
    for (let i = 0; i < buckets.length; i++) {
      const [lo, hi] = buckets[i];
      if ((lo === 0 && hi === 0 && x === 0) || (x >= lo && x < hi && hi !== 0)) { counts[i]++; break; }
    }
  }

  const N = L0 * L1 * L2 * L3;
  const rtp = total / N;
  console.log(`\n── ${mode} base game (lines only; feature: npm run dragon:sim -- ${mode})`);
  console.log(`Combinations : ${N.toLocaleString()}`);
  console.log(`Base RTP     : ${(rtp * 100).toFixed(3)}%`);
  console.log(`Hit frequency: ${(hits / N * 100).toFixed(2)}%  (1 in ${(N / hits).toFixed(2)})`);
  console.log(`Std deviation: ${Math.sqrt(sumSq / N - rtp * rtp).toFixed(2)} × bet`);
  console.log(`Max win      : ${maxWin.toFixed(2)} × bet`);
  buckets.forEach(([lo, hi], i) => {
    const label = lo === 0 && hi === 0 ? 'no win' : `${lo === 0.0001 ? '>0' : lo}–${hi === Infinity ? '∞' : hi}`;
    console.log(`  ${label.padEnd(8)} ${(counts[i] / N * 100).toFixed(4)}%`);
  });
}

// Design invariants: the sticky wild lives only in the nest, the scatters (egg, dragon) only in the base game.
for (const [mode, s] of Object.entries(strips)) {
  const { scatters, sticky } = cfg.respin;
  if (s.reels.some(r => r.includes(sticky))) throw new Error(`${mode}: "${sticky}" must not be on the base reels`);
  for (const sc of Object.keys(scatters)) {
    if (s.nest.some(r => r.includes(sc))) throw new Error(`${mode}: scatter "${sc}" must not be on the nest reels`);
    if (!s.reels.some(r => r.includes(sc))) throw new Error(`${mode}: base reels need scatter "${sc}"`);
  }
  if (!s.nest.some(r => r.includes(sticky))) throw new Error(`${mode}: nest reels need "${sticky}"`);
}

for (const [mode, s] of Object.entries(strips)) report(mode, s.reels);
