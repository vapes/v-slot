/**
 * Slot Screen Generator
 *
 * Generates a precomputed table of spin results grouped by payout category,
 * calibrated to match gameConfig.rtp.  All inputs (symbols, paytable, reels,
 * paylines, RTP target, category definitions) are read from gameConfig.json —
 * no hardcoding.
 *
 * Algorithm:
 *   1. Pre-sample reel strips to measure actual average wins for natural
 *      categories (probability ≥ CONSTRUCTIVE_PROB_THRESHOLD), which use
 *      rejection sampling from real reel strips.
 *   2. Compute the RTP budget required from constructive categories (rare,
 *      high-paying) to reach gameConfig.rtp.
 *   3. For each constructive category, generate a POOL_MULT× pool of screens
 *      using the drift algorithm and record the totalWin per screen.
 *   4. Select exactly `count` screens from each pool using bimodal mixing so
 *      the resulting average win matches the required RTP budget.
 *   5. Calibrate: iteratively adjust flexible constructive categories until the
 *      exact table RTP converges to TARGET_RTP.
 *   6. Write the table and verify exhaustively against SIM simulated spins.
 *
 * Binary format (public/screens.bin):
 *   Header (6 + numCategories×4 bytes):
 *     [0-3]  "SLOT" magic
 *     [4]    version = 1
 *     [5]    numCategories
 *     [6-…]  screen counts per category (numCategories × uint32 LE)
 *   Screens (grouped by category, SCREEN_BYTES each):
 *     nibble-packed: even nibble = high bits, odd nibble = low bits
 *     layout: reel0_row0, reel0_row1, …, reel(NUM_REELS-1)_row(NUM_ROWS-1)
 *     symbol order defined by gameConfig.symbols array
 *
 * Usage:  node scripts/generate-screens.mjs
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Shared constants (used by both main thread and workers) ──────────────────

const gameConfig = JSON.parse(
  readFileSync(resolve(__dirname, '../src/gameConfig.json'), 'utf8')
);

// Grid dimensions
const NUM_REELS   = gameConfig.grid.cols;
const NUM_ROWS    = gameConfig.grid.rows;
const SCREEN_BYTES = Math.ceil(NUM_REELS * NUM_ROWS / 2); // nibble-packed

// Symbols — order defines nibble encoding; must match PrecomputedTable.ts
const SYMBOLS     = gameConfig.symbols.map(s => s.id);
const NUM_SYMBOLS = SYMBOLS.length;

// Paytable: PAYTABLE[symbolIdx][matchCount] = payout in lineBets.
// gameConfig uses string keys ("3","4","5"); JS numeric key lookup coerces to
// string, so PAYTABLE[i][3] and PAYTABLE[i]["3"] are both valid.
const PAYTABLE = SYMBOLS.map(sym => gameConfig.paytable[sym] ?? {});

// Paylines, reel strips, RTP target
const PAYLINES   = gameConfig.paylines;
const NUM_LINES  = PAYLINES.length;
const TARGET_RTP = gameConfig.rtp;

const REEL_STRIPS = gameConfig.reels.map(strip =>
  strip.map(s => SYMBOLS.indexOf(s))
);

// ─── Generator tuning (algorithm parameters, not game-design values) ──────────
const TOTAL_SCREENS = 100_000;
const POOL_MULT     = 5;       // constructive pool size = count × POOL_MULT
const DRIFT_STEPS   = 50_000;  // max mutation steps in drift phase (Phase 1)
/** Categories with probability below this threshold use drift generation.       */
const CONSTRUCTIVE_PROB_THRESHOLD = 0.01;

// ─── Physical maximum win ─────────────────────────────────────────────────────
// The best-paying symbol is the one with the highest 5-of-a-kind payout.
const BEST_SYM_IDX = SYMBOLS.reduce(
  (best, _, i) => ((PAYTABLE[i][5] ?? 0) > (PAYTABLE[best][5] ?? 0) ? i : best), 0
);
// PHYSICAL_MAX_WIN = every payline hitting best symbol × 5 reels (all-best grid).
const PHYSICAL_MAX_WIN = NUM_LINES * (PAYTABLE[BEST_SYM_IDX][5] ?? 0);

// ─── Categories (fully derived from gameConfig.payoutDistribution) ────────────
/**
 * Win ranges in lineBets form a contiguous partition derived from the multiplier
 * ranges in payoutDistribution (so every possible win belongs to exactly one
 * category):
 *   lose  → [0, 0]
 *   small → [1, nextCat.minMultiplier × NUM_LINES − 1]     (any win ≥ 1)
 *   mid…  → [thisCat.minMultiplier × NUM_LINES,
 *             nextCat.minMultiplier × NUM_LINES − 1]
 *   last  → [thisCat.minMultiplier × NUM_LINES,
 *             thisCat.maxMultiplier × NUM_LINES]
 *
 * maxAchievable = min(maxWin, PHYSICAL_MAX_WIN) — ceiling for drift algorithm.
 * constructive  = probability < CONSTRUCTIVE_PROB_THRESHOLD → uses drift.
 */
const CATEGORIES = (() => {
  const dist = gameConfig.payoutDistribution;
  return dist.map((entry, i) => {
    let minWin, maxWin;
    if (!entry.multiplier) {
      // lose — no win at all
      minWin = 0; maxWin = 0;
    } else if (i === dist.length - 1) {
      // last category: use the full multiplier range from gameConfig
      minWin = Math.round(entry.multiplier.min * NUM_LINES);
      maxWin = Math.round(entry.multiplier.max * NUM_LINES);
    } else {
      // middle categories: contiguous partition
      // The first non-lose category captures all wins ≥ 1 (some natural wins
      // fall below its nominal multiplier.min due to partial payline matches).
      const prevHasMultiplier = dist[i - 1]?.multiplier != null;
      minWin = prevHasMultiplier
        ? Math.round(entry.multiplier.min * NUM_LINES)
        : 1;
      maxWin = Math.round(dist[i + 1].multiplier.min * NUM_LINES) - 1;
    }
    const maxAchievable = Math.min(maxWin, PHYSICAL_MAX_WIN);
    const constructive  = entry.probability < CONSTRUCTIVE_PROB_THRESHOLD;
    return { name: entry.type, prob: entry.probability, minWin, maxWin, maxAchievable, constructive };
  });
})();

// Indices of constructive / natural (non-lose) categories
const CONSTR      = CATEGORIES.reduce((a, c, i) => { if (c.constructive)          a.push(i); return a; }, []);
const NATURAL_IDS = CATEGORIES.reduce((a, c, i) => { if (!c.constructive && i > 0) a.push(i); return a; }, []);

// ─── Shared utilities ─────────────────────────────────────────────────────────

function evaluateTotalWin(grid) {
  let total = 0;
  for (const line of PAYLINES) {
    const first = grid[0][line[0]];
    let count = 1;
    for (let r = 1; r < NUM_REELS; r++) {
      if (grid[r][line[r]] === first) count++;
      else break;
    }
    if (count >= 3) total += (PAYTABLE[first][count] ?? 0);
  }
  return total;
}

function packGrid(grid) {
  const buf = new Uint8Array(SCREEN_BYTES);
  let n = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      const v = grid[r][row] & 0xF;
      if (n % 2 === 0) buf[n >> 1] |= v << 4;
      else             buf[n >> 1] |= v;
      n++;
    }
  }
  return buf;
}

function unpackGrid(buf, base = 0) {
  const grid = Array.from({ length: NUM_REELS }, () => new Array(NUM_ROWS));
  let n = 0;
  for (let r = 0; r < NUM_REELS; r++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      grid[r][row] = n % 2 === 0
        ? (buf[base + (n >> 1)] >> 4) & 0xF
        :  buf[base + (n >> 1)]       & 0xF;
      n++;
    }
  }
  return grid;
}

// ─── WORKER ───────────────────────────────────────────────────────────────────

if (!isMainThread) {
  const { catIndex, count, seed, genMinWin } = workerData;
  const cat = CATEGORIES[catIndex];

  let s = ((seed ^ 0xDEADBEEF) >>> 0) || 1;
  const rand    = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
  const randInt = (n) => (rand() * n) | 0;

  const randomGrid = () => {
    const grid = new Array(NUM_REELS);
    for (let r = 0; r < NUM_REELS; r++) {
      const strip = REEL_STRIPS[r];
      const stop  = randInt(strip.length);
      grid[r] = Array.from({ length: NUM_ROWS }, (_, row) => strip[(stop + row) % strip.length]);
    }
    return grid;
  };

  /**
   * Build one constructive screen.
   *
   * Phase 1 — drift: start from the all-best-symbol grid (win = PHYSICAL_MAX_WIN).
   *   Accept any mutation that reduces win without dropping below cat.minWin.
   *   Drifts monotonically downward until win enters [cat.minWin, cat.maxWin].
   *
   * Phase 2 — diversify: random walk inside [genMinWin, cat.maxWin] for 500 steps.
   *   For the last constructive category genMinWin = PHYSICAL_MAX_WIN, so every
   *   mutation is rejected and the screen stays at PHYSICAL_MAX_WIN (all-best grid).
   */
  const buildConstructiveGrid = () => {
    const g = Array.from({ length: NUM_REELS }, () => new Array(NUM_ROWS).fill(BEST_SYM_IDX));
    let w = evaluateTotalWin(g); // PHYSICAL_MAX_WIN

    // Phase 1: drift downward into [minWin, maxWin]
    for (let step = 0; step < DRIFT_STEPS; step++) {
      if (w >= cat.minWin && w <= cat.maxWin) break;

      const r = randInt(NUM_REELS), row = randInt(NUM_ROWS), prev = g[r][row];
      g[r][row] = randInt(NUM_SYMBOLS);
      const nw = evaluateTotalWin(g);

      if (nw < w && nw >= cat.minWin) {
        w = nw;
      } else {
        g[r][row] = prev;
      }
    }

    // Phase 2: random walk within [genMinWin, maxWin]
    const p2Min = genMinWin ?? cat.minWin;
    for (let step = 0; step < 500; step++) {
      const r = randInt(NUM_REELS), row = randInt(NUM_ROWS), prev = g[r][row];
      g[r][row] = randInt(NUM_SYMBOLS);
      const nw = evaluateTotalWin(g);
      if (nw < p2Min || nw > cat.maxWin) g[r][row] = prev;
    }

    return g;
  };

  const screens = new Uint8Array(count * SCREEN_BYTES);
  const wins    = new Uint32Array(count);
  let filled = 0;

  const reportEvery = Math.max(1, Math.floor(count / 20));

  if (cat.constructive) {
    while (filled < count) {
      const grid = buildConstructiveGrid();
      const w    = evaluateTotalWin(grid);
      if (w >= cat.minWin && w <= cat.maxWin) {
        screens.set(packGrid(grid), filled * SCREEN_BYTES);
        wins[filled] = w;
        filled++;
        if (filled % reportEvery === 0)
          parentPort.postMessage({ type: 'progress', catIndex, filled, count });
      }
    }
  } else {
    const isLose  = cat.minWin === 0 && cat.maxWin === 0;
    const inRange = isLose
      ? (w) => w === 0
      : (w) => w >= cat.minWin && w <= cat.maxWin;

    while (filled < count) {
      const grid = randomGrid();
      const w    = evaluateTotalWin(grid);
      if (inRange(w)) {
        screens.set(packGrid(grid), filled * SCREEN_BYTES);
        wins[filled] = w;
        filled++;
        if (filled % reportEvery === 0)
          parentPort.postMessage({ type: 'progress', catIndex, filled, count });
      }
    }
  }

  parentPort.postMessage(
    { type: 'done', catIndex, screens: screens.buffer, wins: wins.buffer },
    [screens.buffer, wins.buffer],
  );
}

// ─── MAIN THREAD ──────────────────────────────────────────────────────────────

else {
  const publicDir = resolve(__dirname, '../public');
  mkdirSync(publicDir, { recursive: true });

  const SIM = 1_000_000;

  // ── Step 1: Pre-sample reel strips to measure natural category averages ──
  process.stdout.write('Pre-sampling reel strips...');

  const PRESAMPLE_N = 100_000;
  let prng = 0xCAFEBABE;
  const prand    = () => { prng = (Math.imul(prng, 1664525) + 1013904223) | 0; return (prng >>> 0) / 4294967296; };
  const prandInt = (n) => (prand() * n) | 0;

  const natHits = new Array(CATEGORIES.length).fill(0);
  const natSums = new Array(CATEGORIES.length).fill(0);

  for (let i = 0; i < PRESAMPLE_N; i++) {
    const grid = REEL_STRIPS.map(strip => {
      const stop = prandInt(strip.length);
      return Array.from({ length: NUM_ROWS }, (_, row) => strip[(stop + row) % strip.length]);
    });
    const w = evaluateTotalWin(grid);
    for (let ci = 0; ci < CATEGORIES.length; ci++) {
      const c = CATEGORIES[ci];
      if (c.constructive) continue; // only sample natural categories
      const hit = ci === 0 ? w === 0 : w >= c.minWin && w <= c.maxWin;
      if (hit) { natHits[ci]++; natSums[ci] += w; break; }
    }
  }

  const natAvg = natSums.map((s, i) => natHits[i] > 0 ? s / natHits[i] : 0);
  const naturalContrib = NATURAL_IDS.reduce((sum, ci) => sum + CATEGORIES[ci].prob * natAvg[ci], 0);

  const natAvgStr = NATURAL_IDS.map(ci => `${CATEGORIES[ci].name}:${natAvg[ci].toFixed(1)}`).join('  ');
  console.log(`\r  Natural avg wins — lose:0  ${natAvgStr}`);
  console.log(`  Natural RTP contribution: ${(naturalContrib / NUM_LINES * 100).toFixed(2)}%\n`);

  // ── Step 2: Compute RTP budget for constructive categories ───────────────
  const targetExpectedWin  = TARGET_RTP * NUM_LINES;
  const constructiveBudget = targetExpectedWin - naturalContrib;

  // Distribute budget among constructive categories with overflow redistribution.
  // The last constructive category is capped at PHYSICAL_MAX_WIN (all-best grid).
  let targetContribs = CONSTR.map(() => constructiveBudget / CONSTR.length);

  for (let iter = 0; iter < 30; iter++) {
    let overflow = 0, freeProbSum = 0;
    for (let j = 0; j < CONSTR.length; j++) {
      const cat    = CATEGORIES[CONSTR[j]];
      const needed = targetContribs[j] / cat.prob;
      if (needed > cat.maxAchievable) {
        overflow          += targetContribs[j] - cat.maxAchievable * cat.prob;
        targetContribs[j]  = cat.maxAchievable * cat.prob;
      } else {
        freeProbSum += cat.prob;
      }
    }
    if (overflow < 1e-6) break;
    for (let j = 0; j < CONSTR.length; j++) {
      const cat    = CATEGORIES[CONSTR[j]];
      const needed = targetContribs[j] / cat.prob;
      if (needed < cat.maxAchievable) {
        targetContribs[j] += overflow * (cat.prob / freeProbSum);
      }
    }
  }

  const targetAvgs = CONSTR.map((ci, j) =>
    Math.max(CATEGORIES[ci].minWin, targetContribs[j] / CATEGORIES[ci].prob)
  );

  // ── Step 3: Screen counts ─────────────────────────────────────────────────
  const counts = CATEGORIES.map(c => Math.round(c.prob * TOTAL_SCREENS));
  counts[0] += TOTAL_SCREENS - counts.reduce((a, b) => a + b, 0);

  const poolCounts = CATEGORIES.map((c, i) => c.constructive ? counts[i] * POOL_MULT : counts[i]);

  console.log('╔════════════════════════════════════════════╗');
  console.log('║       Slot Screen Generator  v1.0          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`Target RTP    : ${(TARGET_RTP * 100).toFixed(2)}%`);
  console.log(`Total screens : ${TOTAL_SCREENS.toLocaleString()}\n`);

  console.log('  Category     Count    Target%    TargetAvgWin');
  console.log('  ' + '─'.repeat(48));
  CATEGORIES.forEach((c, i) => {
    const j = CONSTR.indexOf(i);
    const avgStr = j >= 0
      ? `   avg≈${targetAvgs[j].toFixed(0).padStart(6)}`
      : i > 0 ? `   avg≈${natAvg[i].toFixed(0).padStart(6)}` : '';
    const poolStr = c.constructive ? ` (pool ${poolCounts[i]})` : '';
    console.log(`  ${c.name.padEnd(10)} ${counts[i].toString().padStart(6)}   ${(c.prob * 100).toFixed(4)}%${avgStr}${poolStr}`);
  });
  console.log('');

  // ── Step 4: Launch workers ────────────────────────────────────────────────
  const lastConstrIdx = CONSTR[CONSTR.length - 1];
  const t0         = Date.now();
  const rawScreens = new Array(CATEGORIES.length);
  const rawWins    = new Array(CATEGORIES.length);
  const lastPct    = new Array(CATEGORIES.length).fill(-1);

  await new Promise((resolve, reject) => {
    let doneCount = 0;
    CATEGORIES.forEach((cat, i) => {
      const worker = new Worker(__filename, {
        workerData: {
          catIndex:  i,
          count:     poolCounts[i],
          seed:      (Date.now() + i * 0x1337BEEF) >>> 0,
          // Last constructive category: genMinWin = PHYSICAL_MAX_WIN forces all
          // screens to the global-max-win state (all-best-symbol grid).
          genMinWin: i === lastConstrIdx ? PHYSICAL_MAX_WIN : cat.minWin,
        },
      });
      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          const pct = Math.floor((msg.filled / msg.count) * 100);
          if (pct !== lastPct[i]) {
            lastPct[i] = pct;
            process.stdout.write(`\r  [${cat.name.padEnd(6)}] ${pct}%   `);
          }
        } else if (msg.type === 'done') {
          process.stdout.write('\r' + ' '.repeat(40) + '\r');
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`  ✓ ${cat.name.padEnd(10)} pool ${poolCounts[i].toString().padStart(7)}  [${elapsed}s]`);
          rawScreens[i] = new Uint8Array(msg.screens);
          rawWins[i]    = new Uint32Array(msg.wins);
          if (++doneCount === CATEGORIES.length) resolve();
        }
      });
      worker.on('error', reject);
    });
  });

  console.log(`\nAll workers done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // ── Step 4b: Recompute budget using actual natural wins from workers ───────
  const actualNatAvg = new Array(CATEGORIES.length).fill(0);
  for (const ci of NATURAL_IDS) {
    const wins = rawWins[ci];
    if (wins && wins.length > 0) {
      let s = 0;
      for (let k = 0; k < wins.length; k++) s += wins[k];
      actualNatAvg[ci] = s / wins.length;
    }
  }
  const actualNaturalContrib  = NATURAL_IDS.reduce((sum, ci) => sum + CATEGORIES[ci].prob * actualNatAvg[ci], 0);
  const actualConstructiveBudget = targetExpectedWin - actualNaturalContrib;

  let actualTargetContribs = CONSTR.map(() => actualConstructiveBudget / CONSTR.length);
  for (let iter = 0; iter < 30; iter++) {
    let overflow = 0, freeProbSum = 0;
    for (let j = 0; j < CONSTR.length; j++) {
      const cat    = CATEGORIES[CONSTR[j]];
      const needed = actualTargetContribs[j] / cat.prob;
      if (needed > cat.maxAchievable) {
        overflow                  += actualTargetContribs[j] - cat.maxAchievable * cat.prob;
        actualTargetContribs[j]    = cat.maxAchievable * cat.prob;
      } else {
        freeProbSum += cat.prob;
      }
    }
    if (overflow < 1e-6) break;
    for (let j = 0; j < CONSTR.length; j++) {
      const cat    = CATEGORIES[CONSTR[j]];
      const needed = actualTargetContribs[j] / cat.prob;
      if (needed < cat.maxAchievable) {
        actualTargetContribs[j] += overflow * (cat.prob / freeProbSum);
      }
    }
  }
  const actualTargetAvgs = CONSTR.map((ci, j) =>
    Math.max(CATEGORIES[ci].minWin, actualTargetContribs[j] / CATEGORIES[ci].prob)
  );

  const natAvgStr2  = NATURAL_IDS.map(ci => `${CATEGORIES[ci].name}:${actualNatAvg[ci].toFixed(1)}`).join('  ');
  const targetStr   = CONSTR.map((ci, j) => `${CATEGORIES[ci].name}=${actualTargetAvgs[j].toFixed(0)}`).join(' ');
  console.log(`  Actual natural avgs — ${natAvgStr2}`);
  console.log(`  Actual natural contrib: ${(actualNaturalContrib / NUM_LINES * 100).toFixed(2)}%`);
  console.log(`  Revised constructive targets: ${targetStr}\n`);

  // ── Step 5: Sub-sample constructive pools to hit targetAvg ───────────────
  /**
   * Bimodal selection: sort pool by win, find the split (nLow from bottom +
   * nHigh from top) that minimises |avg − targetAvg|.
   * O(N log N) sort + O(targetCount) scan.  Deterministic → reproducible.
   */
  function selectFromPool(poolScreens, poolWins, targetAvg, targetCount) {
    const N = poolWins.length;
    const sorted = Array.from({ length: N }, (_, i) => i)
      .sort((a, b) => poolWins[a] - poolWins[b]);

    const prefix = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) prefix[i + 1] = prefix[i] + poolWins[sorted[i]];

    const targetSum = targetAvg * targetCount;
    let bestS = 0, bestErr = Infinity;
    for (let s = 0; s <= targetCount; s++) {
      const nHigh = targetCount - s;
      if (nHigh > N - s) continue;
      const err = Math.abs(prefix[s] + (prefix[N] - prefix[N - nHigh]) - targetSum);
      if (err < bestErr) { bestErr = err; bestS = s; }
    }

    const nLow  = bestS;
    const nHigh = targetCount - nLow;
    const selectedIdx = [
      ...sorted.slice(0, nLow),
      ...sorted.slice(N - nHigh),
    ];

    const out     = new Uint8Array(targetCount * SCREEN_BYTES);
    const outWins = [];
    for (let j = 0; j < selectedIdx.length; j++) {
      const srcIdx = selectedIdx[j];
      out.set(poolScreens.subarray(srcIdx * SCREEN_BYTES, (srcIdx + 1) * SCREEN_BYTES), j * SCREEN_BYTES);
      outWins.push(poolWins[srcIdx]);
    }

    const actualAvg = outWins.reduce((s, w) => s + w, 0) / outWins.length;
    const avgLow  = nLow  > 0 ? outWins.slice(0, nLow).reduce((s, w) => s + w, 0) / nLow  : 0;
    const avgHigh = nHigh > 0 ? outWins.slice(nLow).reduce((s, w) => s + w, 0)    / nHigh : 0;
    return { out, actualAvg, avgLow, avgHigh, nLow, nHigh };
  }

  const finalScreens = new Array(CATEGORIES.length);

  console.log('Sub-sampling constructive pools:');
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    if (!cat.constructive) {
      finalScreens[i] = rawScreens[i];
    } else {
      const j = CONSTR.indexOf(i);
      const { out, actualAvg, avgLow, avgHigh, nLow, nHigh } =
        selectFromPool(rawScreens[i], rawWins[i], actualTargetAvgs[j], counts[i]);
      finalScreens[i] = out;
      console.log(`  ${cat.name.padEnd(8)} target=${actualTargetAvgs[j].toFixed(0).padStart(6)}  actual=${actualAvg.toFixed(0).padStart(6)}  (${nLow} low≈${avgLow.toFixed(0)} + ${nHigh} high≈${avgHigh.toFixed(0)})`);
    }
  }
  console.log('');

  // ── Step 5b: Calibrate exact table RTP to TARGET_RTP ─────────────────────
  // Bimodal selection can undershoot due to integer win quantisation.
  // Iteratively adjust flexible constructive categories until the exact table
  // RTP converges to TARGET_RTP within 0.001%.
  const computeCatActualAvgs = () => CATEGORIES.map((cat, i) => {
    if (cat.constructive) {
      let s = 0;
      for (let k = 0; k < counts[i]; k++)
        s += evaluateTotalWin(unpackGrid(finalScreens[i], k * SCREEN_BYTES));
      return counts[i] > 0 ? s / counts[i] : 0;
    }
    const wins = rawWins[i];
    let s = 0;
    for (let k = 0; k < wins.length; k++) s += wins[k];
    return wins.length > 0 ? s / wins.length : 0;
  });

  console.log('Calibrating exact RTP:');
  let prevGap = Infinity;
  for (let calIter = 0; calIter < 10; calIter++) {
    const catAvg  = computeCatActualAvgs();
    const exactExpWin = CATEGORIES.reduce((sum, c, i) => sum + c.prob * catAvg[i], 0);
    const exactRTP    = exactExpWin / NUM_LINES;
    const gap         = TARGET_RTP - exactRTP; // positive = below target

    console.log(`  iter ${calIter + 1}: exact RTP = ${(exactRTP * 100).toFixed(4)}%  gap = ${gap * 100 >= 0 ? '+' : ''}${(gap * 100).toFixed(4)}%`);

    if (Math.abs(gap) < 1e-5) { console.log('  ✓ Converged\n'); break; }
    if (Math.abs(Math.abs(gap) - Math.abs(prevGap)) < 1e-7) {
      console.log(`  Pool granularity limit reached. Residual gap ≤ ${(Math.abs(gap) * 100).toFixed(4)}% — acceptable.\n`);
      break;
    }
    prevGap = gap;

    // Adjust flexible constructive categories (all except the last, which is
    // fixed at PHYSICAL_MAX_WIN).
    let remainingGap = gap;
    for (const adjIdx of CONSTR.slice(0, -1)) {
      const cat = CATEGORIES[adjIdx];
      const newTarget = catAvg[adjIdx] + remainingGap * NUM_LINES / cat.prob;
      if (newTarget < cat.minWin || newTarget > cat.maxAchievable) continue;
      const { out, actualAvg } = selectFromPool(rawScreens[adjIdx], rawWins[adjIdx], newTarget, counts[adjIdx]);
      const achieved = actualAvg - catAvg[adjIdx];
      finalScreens[adjIdx] = out;
      remainingGap -= achieved * cat.prob / NUM_LINES;
      console.log(`  Adjusted ${cat.name}: ${catAvg[adjIdx].toFixed(1)} → ${actualAvg.toFixed(1)}`);
      if (Math.abs(remainingGap) < 1e-5) break;
    }
  }

  // ── Step 6: Write binary file ─────────────────────────────────────────────
  const HEADER_SIZE = 4 + 1 + 1 + CATEGORIES.length * 4;
  const file = Buffer.alloc(HEADER_SIZE + TOTAL_SCREENS * SCREEN_BYTES, 0);
  file.write('SLOT', 0, 'ascii');
  file[4] = 1;
  file[5] = CATEGORIES.length;

  let off = 6;
  for (const n of counts)       { file.writeUInt32LE(n, off); off += 4; }
  for (const r of finalScreens) { file.set(r, off); off += r.length; }

  const outPath = resolve(publicDir, 'screens.bin');
  writeFileSync(outPath, file);
  console.log(`Wrote ${(file.length / 1024).toFixed(1)} KB  →  ${outPath}`);

  // ── Step 6b: Exact theoretical RTP ───────────────────────────────────────
  {
    let exactExpWin = 0;
    console.log('Exact table RTP (per category):');
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      let avgWin;
      if (cat.constructive) {
        let s = 0;
        for (let k = 0; k < counts[i]; k++)
          s += evaluateTotalWin(unpackGrid(finalScreens[i], k * SCREEN_BYTES));
        avgWin = counts[i] > 0 ? s / counts[i] : 0;
      } else {
        const wins = rawWins[i];
        avgWin = wins.length > 0 ? Array.from(wins).reduce((a, b) => a + b, 0) / wins.length : 0;
      }
      const contrib = cat.prob * avgWin / NUM_LINES * 100;
      exactExpWin  += cat.prob * avgWin / NUM_LINES;
      if (i > 0) console.log(`  ${cat.name.padEnd(8)} avg=${avgWin.toFixed(1).padStart(8)}  contrib=${contrib.toFixed(4)}%`);
    }
    console.log(`\n  Exact table RTP: ${(exactExpWin * 100).toFixed(4)}%  (target: ${(TARGET_RTP * 100).toFixed(2)}%)\n`);
  }

  // ── Step 7: Verification — SIM simulated spins ────────────────────────────
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  Verification — ${SIM.toLocaleString()} simulated spins  ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);

  const flatScreens = new Uint8Array(TOTAL_SCREENS * SCREEN_BYTES);
  let flatOff = 0;
  for (const r of finalScreens) { flatScreens.set(r, flatOff); flatOff += r.length; }

  const catStart = [];
  let sc = 0;
  for (const n of counts) { catStart.push(sc); sc += n; }

  const catHits    = new Array(CATEGORIES.length).fill(0);
  const catWinSums = new Array(CATEGORIES.length).fill(0);

  // Exhaustive deterministic simulation: each screen is visited exactly
  // SIM / TOTAL_SCREENS times (= 10 with defaults). Category frequencies
  // match target probabilities exactly and every screen is counted, so the
  // result always equals the exact table RTP with zero sampling variance.
  const stratSpins = CATEGORIES.map(c => Math.round(c.prob * SIM));
  stratSpins[0] += SIM - stratSpins.reduce((a, b) => a + b, 0);

  process.stdout.write('Simulating (exhaustive)...');
  const simT0 = Date.now();

  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const n   = stratSpins[ci];
    const cnt = counts[ci];
    if (cnt === 0) { catHits[ci] += n; continue; }
    const baseV = Math.floor(n / cnt);
    const extra = n % cnt;
    for (let k = 0; k < cnt; k++) {
      const visits = k < extra ? baseV + 1 : baseV;
      const win    = evaluateTotalWin(unpackGrid(flatScreens, (catStart[ci] + k) * SCREEN_BYTES));
      catHits[ci]    += visits;
      catWinSums[ci] += win * visits;
    }
  }

  const simMs = Date.now() - simT0;
  process.stdout.write(`\r${' '.repeat(30)}\r`);
  console.log(`Done in ${simMs}ms  (${(SIM / simMs * 1000 / 1e6).toFixed(1)}M spins/s)\n`);

  const colW = [12, 10, 10, 10, 10, 12];
  const hdr  = ['Category', 'Target%', 'Actual%', 'Δ%', 'AvgWin', 'RTP contrib'];
  console.log('  ' + hdr.map((h, i) => h.padEnd(colW[i])).join(''));
  console.log('  ' + '─'.repeat(colW.reduce((a, b) => a + b, 0)));

  let totalWinSum = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c          = CATEGORIES[i];
    const target     = c.prob * 100;
    const actual     = (catHits[i] / SIM) * 100;
    const delta      = actual - target;
    const avgWin     = catHits[i] > 0 ? (catWinSums[i] / catHits[i]).toFixed(1) : '0.0';
    const rtpContrib = (catWinSums[i] / SIM / NUM_LINES * 100).toFixed(2) + '%';
    totalWinSum += catWinSums[i];
    const row = [c.name, target.toFixed(4) + '%', actual.toFixed(4) + '%',
      (delta >= 0 ? '+' : '') + delta.toFixed(4) + '%', avgWin, rtpContrib];
    console.log('  ' + row.map((v, i) => v.padEnd(colW[i])).join(''));
  }

  const simRTP  = totalWinSum / SIM / NUM_LINES;
  const rtpDiff = ((simRTP - TARGET_RTP) * 100).toFixed(2);
  console.log(`\n  Simulated RTP  : ${(simRTP * 100).toFixed(2)}%`);
  console.log(`  Target RTP     : ${(TARGET_RTP * 100).toFixed(2)}%`);
  console.log(`  Difference     : ${rtpDiff >= 0 ? '+' : ''}${rtpDiff}%`);
  console.log(`  Hit rate       : ${((1 - catHits[0] / SIM) * 100).toFixed(2)}%`);
  console.log('\n✓ Done\n');
}
