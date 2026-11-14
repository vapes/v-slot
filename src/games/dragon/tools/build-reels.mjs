/**
 * Reel strip builder + exact math report.
 *
 * Reads `reelComposition` (symbol counts per reel) from ../config.json,
 * builds deterministic reel strips (seeded shuffle that avoids identical
 * neighbours), writes them to `reels`, then enumerates EVERY stop combination
 * to report exact RTP, hit frequency and win distribution.
 *
 * Usage:  npm run dragon:reels                (build strips + report)
 *         npm run dragon:reels -- --report    (report only, keep strips)
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CONFIG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../config.json');
let raw = readFileSync(CONFIG_PATH, 'utf8');
const cfg = JSON.parse(raw);
const reportOnly = process.argv.includes('--report');

// ── Strip building ────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Composition counts are blocks; `reelStacks` gives the block height per symbol. */
function buildStrip(composition, seed) {
  const rnd = mulberry32(seed);
  const stacks = cfg.reelStacks ?? {};
  const bag = Object.entries(composition).flatMap(([s, n]) => Array(n).fill(s));
  for (let attempt = 0; attempt < 10_000; attempt++) {
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const ok = bag.every((s, i) => s !== bag[(i + 1) % bag.length]);
    if (ok) return bag.flatMap(s => Array(stacks[s] ?? 1).fill(s));
  }
  throw new Error('Could not build strip without identical neighbours');
}

let reels = cfg.reels;
if (!reportOnly) {
  reels = cfg.reelComposition.map((comp, i) => buildStrip(comp, 1000 + i));
  // Nest (respin) strips live in "respin.strips"; base strips in the last key "reels".
  const nest = cfg.respin.composition.map((comp, i) => buildStrip(comp, 2000 + i));
  const nestBody = nest.map(r => '      ' + JSON.stringify(r)).join(',\n');
  raw = raw.replace(/"strips": \[[\s\S]*?\n?    \]|"strips": \[\]/, `"strips": [\n${nestBody}\n    ]`);
  console.log('Nest strips written:', nest.map(r => r.length).join(' / '));

  const body = reels.map(r => '    ' + JSON.stringify(r)).join(',\n');
  // `reels` is the last key of config.json — replace from it to the end.
  const at = raw.indexOf('  "reels": [');
  if (at < 0) throw new Error('"reels" key not found in config.json');
  const out = raw.slice(0, at) + `  "reels": [\n${body}\n  ]\n}\n`;
  writeFileSync(CONFIG_PATH, out);
  console.log('Reel strips written:', reels.map(r => r.length).join(' / '));
}

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

const [L0, L1, L2, L3] = reels.map(r => r.length);
const windowAt = (strip, stop) => Array.from({ length: ROWS }, (_, k) => strip[(stop + k) % strip.length]);
const win0 = reels[0].map((_, i) => windowAt(reels[0], i));
const win1 = reels[1].map((_, i) => windowAt(reels[1], i));
const win2 = reels[2].map((_, i) => windowAt(reels[2], i));
const win3 = reels[3].map((_, i) => windowAt(reels[3], i));

const buckets = [[0, 0], [0.0001, 1], [1, 2], [2, 5], [5, 20], [20, 50], [50, Infinity]];
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
console.log(`Combinations : ${N.toLocaleString()}`);
console.log(`RTP          : ${(rtp * 100).toFixed(3)}%`);
console.log(`Hit frequency: ${(hits / N * 100).toFixed(2)}%  (1 in ${(N / hits).toFixed(2)})`);
console.log(`Std deviation: ${Math.sqrt(sumSq / N - rtp * rtp).toFixed(2)} × bet`);
console.log(`Max win      : ${maxWin.toFixed(2)} × bet`);
console.log('Win distribution (× total bet):');
buckets.forEach(([lo, hi], i) => {
  const label = lo === 0 && hi === 0 ? 'no win' : `${lo === 0.0001 ? '>0' : lo}–${hi === Infinity ? '∞' : hi}`;
  console.log(`  ${label.padEnd(8)} ${(counts[i] / N * 100).toFixed(4)}%`);
});
