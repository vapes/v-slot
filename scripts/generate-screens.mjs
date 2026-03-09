/**
 * Slot Screen Generator
 *
 * Generates a precomputed table of spin results grouped by payout category,
 * calibrated to match gameConfig.rtp.
 *
 * Algorithm:
 *   1. Pre-sample reel strips to measure actual average wins for natural categories
 *      (lose/small/medium/big) which use rejection sampling from real reel strips.
 *   2. Compute the RTP budget required from constructive categories (huge/epic/max)
 *      to reach the gameConfig.rtp target.
 *   3. For each constructive category, generate a 5× pool of screens with their
 *      full category range and record the totalWin per screen.
 *   4. Select exactly `count` screens from each pool using bimodal mixing so the
 *      resulting average win matches the required RTP budget exactly.
 *   5. Write the table and verify against 1 000 000 simulated spins.
 *
 * Binary format (public/screens.bin):
 *   Header (34 bytes):
 *     [0-3]  "SLOT" magic
 *     [4]    version = 1
 *     [5]    numCategories = 7
 *     [6-33] screen counts per category (7 × uint32 LE)
 *   Screens (grouped by category, 8 bytes each):
 *     nibble-packed, symbol 0-4 per nibble, 15 nibbles + 1 pad = 8 bytes
 *     layout: reel0_row0, reel0_row1, reel0_row2, reel1_row0, …, reel4_row2
 *     symbol index: V=0 A=1 P=2 E=3 S=4
 *
 * Usage:  node scripts/generate-screens.mjs
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Shared constants ────────────────────────────────────────────────────────

const gameConfig = JSON.parse(
  readFileSync(resolve(__dirname, '../src/gameConfig.json'), 'utf8')
);

const SYMBOLS   = ['V', 'A', 'P', 'E', 'S'];
const PAYLINES  = gameConfig.paylines;
const NUM_LINES = PAYLINES.length;          // 20
const TARGET_RTP = gameConfig.rtp;          // 0.98

const PAYTABLE = [
  { 3: 50,  4: 185, 5: 900 }, // V
  { 3: 25,  4: 90,  5: 450 }, // A
  { 3: 14,  4: 45,  5: 225 }, // P
  { 3: 9,   4: 22,  5: 95  }, // E
  { 3: 5,   4: 10,  5: 45  }, // S
];

const REEL_STRIPS = gameConfig.reels.map(strip =>
  strip.map(s => SYMBOLS.indexOf(s))
);

/**
 * Category win ranges (totalWin in units of lineBet).
 * multiplier in config = totalWin / totalBet = totalWin / (lineBet × NUM_LINES).
 * maxAchievable: the physical maximum totalWin reachable by the drift function
 * (all-V grid = 20 paylines × V/5=900 = 18 000).
 *
 * Constructive categories (huge/epic/max) generate a pool; the pool is then
 * sub-sampled to hit the required RTP budget (see Step 4 in main thread).
 */
const CATEGORIES = [
  { name: 'lose',   prob: 0.7200, minWin: 0,     maxWin: 0,      maxAchievable: 0,     constructive: false },
  { name: 'small',  prob: 0.2000, minWin: 1,     maxWin: 19,     maxAchievable: 19,    constructive: false },
  { name: 'medium', prob: 0.0500, minWin: 20,    maxWin: 100,    maxAchievable: 100,   constructive: false },
  { name: 'big',    prob: 0.0200, minWin: 101,   maxWin: 400,    maxAchievable: 400,   constructive: false },
  { name: 'huge',   prob: 0.0080, minWin: 401,   maxWin: 2000,   maxAchievable: 2000,  constructive: true  },
  { name: 'epic',   prob: 0.0018, minWin: 2001,  maxWin: 10000,  maxAchievable: 10000, constructive: true  },
  { name: 'max',    prob: 0.0002, minWin: 10001, maxWin: 100000, maxAchievable: 18000, constructive: true  },
];

const TOTAL_SCREENS = 100_000;
const SCREEN_BYTES  = 8;   // 15 nibbles + 1 pad = 8 bytes
const POOL_MULT     = 5;   // constructive categories: generate 5× and sub-sample
const DRIFT_STEPS   = 50_000; // mutation steps per constructive screen

// ─── Shared utilities ────────────────────────────────────────────────────────

function evaluateTotalWin(grid) {
  let total = 0;
  for (const line of PAYLINES) {
    const first = grid[0][line[0]];
    let count = 1;
    for (let r = 1; r < 5; r++) {
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
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      const v = grid[r][row] & 0xF;
      if (n % 2 === 0) buf[n >> 1] |= v << 4;
      else             buf[n >> 1] |= v;
      n++;
    }
  }
  return buf;
}

function unpackGrid(buf, base = 0) {
  const grid = Array.from({ length: 5 }, () => new Array(3));
  let n = 0;
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      grid[r][row] = n % 2 === 0
        ? (buf[base + (n >> 1)] >> 4) & 0xF
        :  buf[base + (n >> 1)]       & 0xF;
      n++;
    }
  }
  return grid;
}

// ─── WORKER ──────────────────────────────────────────────────────────────────

if (!isMainThread) {
  const { catIndex, count, seed, genMinWin } = workerData;
  const cat = CATEGORIES[catIndex];

  let s = ((seed ^ 0xDEADBEEF) >>> 0) || 1;
  const rand    = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
  const randInt = (n) => (rand() * n) | 0;

  const randomGrid = () => {
    const grid = new Array(5);
    for (let r = 0; r < 5; r++) {
      const strip = REEL_STRIPS[r];
      const stop  = randInt(strip.length);
      grid[r] = [
        strip[stop],
        strip[(stop + 1) % strip.length],
        strip[(stop + 2) % strip.length],
      ];
    }
    return grid;
  };

  /**
   * Build one constructive screen.
   *
   * Phase 1 — drift:  start from all-V (win = 18 000); accept any cell change
   *   that reduces the win without dropping below cat.minWin.  The walk drifts
   *   down monotonically until the win enters [minWin, maxWin].
   * Phase 2 — diversify: stay inside [minWin, maxWin] for 500 random steps.
   *
   * Phase 1 acceptance:  nw < currentWin  AND  nw >= cat.minWin
   * This guarantees convergence: starting from 18 000, any downward step that
   * keeps us above minWin is accepted, so the win can only decrease.
   */
  const buildConstructiveGrid = () => {
    const g = Array.from({ length: 5 }, () => [0, 0, 0]); // all-V
    let w = evaluateTotalWin(g); // 18 000

    // Phase 1: drift downward into [minWin, maxWin]
    for (let step = 0; step < DRIFT_STEPS; step++) {
      if (w >= cat.minWin && w <= cat.maxWin) break;

      const r = randInt(5), row = randInt(3), prev = g[r][row];
      g[r][row] = randInt(5);
      const nw = evaluateTotalWin(g);

      // Accept only if it reduces win and stays >= minWin
      if (nw < w && nw >= cat.minWin) {
        w = nw;
      } else {
        g[r][row] = prev;
      }
    }

    // Phase 2: random walk within [genMinWin, maxWin]
    // genMinWin may differ from cat.minWin (e.g. max category uses 17001 so all-V grids are preserved)
    const p2Min = genMinWin ?? cat.minWin;
    for (let step = 0; step < 500; step++) {
      const r = randInt(5), row = randInt(3), prev = g[r][row];
      g[r][row] = randInt(5);
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
    const isLose = (cat.minWin === 0 && cat.maxWin === 0);
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

// ─── MAIN THREAD ─────────────────────────────────────────────────────────────

else {
  const publicDir = resolve(__dirname, '../public');
  mkdirSync(publicDir, { recursive: true });

  // ── Step 1: Pre-sample reel strips to measure natural category averages ──
  process.stdout.write('Pre-sampling reel strips...');

  const PRESAMPLE_N = 100_000;
  let prng = 0xCAFEBABE;
  const prand    = () => { prng = (Math.imul(prng, 1664525) + 1013904223) | 0; return (prng >>> 0) / 4294967296; };
  const prandInt = (n) => (prand() * n) | 0;

  const natHits = [0, 0, 0, 0]; // lose, small, medium, big
  const natSums = [0, 0, 0, 0];

  for (let i = 0; i < PRESAMPLE_N; i++) {
    const grid = REEL_STRIPS.map(strip => {
      const stop = prandInt(strip.length);
      return [strip[stop], strip[(stop+1) % strip.length], strip[(stop+2) % strip.length]];
    });
    const w = evaluateTotalWin(grid);
    for (let ci = 0; ci <= 3; ci++) {
      const c = CATEGORIES[ci];
      const hit = ci === 0 ? w === 0 : w >= c.minWin && w <= c.maxWin;
      if (hit) { natHits[ci]++; natSums[ci] += w; break; }
    }
  }

  const natAvg = natSums.map((s, i) => natHits[i] > 0 ? s / natHits[i] : 0);
  // RTP contribution from natural categories (table uses TARGET probabilities):
  const naturalContrib =
    CATEGORIES[1].prob * natAvg[1] +
    CATEGORIES[2].prob * natAvg[2] +
    CATEGORIES[3].prob * natAvg[3];

  console.log(`\r  Natural avg wins — lose:0  small:${natAvg[1].toFixed(1)}  medium:${natAvg[2].toFixed(1)}  big:${natAvg[3].toFixed(1)}`);
  console.log(`  Natural RTP contribution: ${(naturalContrib / NUM_LINES * 100).toFixed(2)}%\n`);

  // ── Step 2: Compute RTP budget for constructive categories ───────────────
  const targetExpectedWin   = TARGET_RTP * NUM_LINES;  // 0.98 × 20 = 19.6
  const constructiveBudget  = targetExpectedWin - naturalContrib;

  // Distribute budget among huge/epic/max with overflow redistribution.
  // targetContribs[j] = how many lineBets category CONSTR[j] must contribute per spin.
  // For max: the physical max achievable win is 18 000 (all-V grid, 20×V/5=900).
  // BUT any single-cell change from all-V drops win by ~5400-9900 (breaks 6-11 paylines).
  // So we generate max screens with a gen range [17 001, 18 000] — this means Phase 2
  // diversification rejects all mutations (each would drop win below 17 001), and ALL
  // max screens stay at win=18 000 (all-V).  Pool avg = 18 000, RTP contribution = correct.
  const MAX_GEN_MIN = 17_001;

  const CONSTR = [4, 5, 6];
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
    // Redistribute overflow to uncapped categories proportionally
    for (let j = 0; j < CONSTR.length; j++) {
      const cat    = CATEGORIES[CONSTR[j]];
      const needed = targetContribs[j] / cat.prob;
      if (needed < cat.maxAchievable) {
        targetContribs[j] += overflow * (cat.prob / freeProbSum);
      }
    }
  }

  // Target average win for each constructive category
  const targetAvgs = CONSTR.map((ci, j) =>
    Math.max(CATEGORIES[ci].minWin, targetContribs[j] / CATEGORIES[ci].prob)
  );

  // ── Step 3: Screen counts ─────────────────────────────────────────────────
  const counts = CATEGORIES.map(c => Math.round(c.prob * TOTAL_SCREENS));
  counts[0] += TOTAL_SCREENS - counts.reduce((a, b) => a + b, 0);

  // Constructive workers generate a larger pool that is later sub-sampled
  const poolCounts = CATEGORIES.map((c, i) => c.constructive ? counts[i] * POOL_MULT : counts[i]);

  console.log('╔════════════════════════════════════════════╗');
  console.log('║       Slot Screen Generator  v1.0          ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`Target RTP    : ${(TARGET_RTP * 100).toFixed(2)}%`);
  console.log(`Total screens : ${TOTAL_SCREENS.toLocaleString()}\n`);

  console.log('  Category     Count    Target%    TargetAvgWin');
  console.log('  ' + '─'.repeat(48));
  CATEGORIES.forEach((c, i) => {
    const j = i - 4;
    const avgStr = c.constructive ? `   avg≈${targetAvgs[j].toFixed(0).padStart(6)}`
      : i >= 1 ? `   avg≈${natAvg[i].toFixed(0).padStart(6)}` : '';
    const poolStr = c.constructive ? ` (pool ${poolCounts[i]})` : '';
    console.log(`  ${c.name.padEnd(10)} ${counts[i].toString().padStart(6)}   ${(c.prob*100).toFixed(4)}%${avgStr}${poolStr}`);
  });
  console.log('');

  // ── Step 4: Launch workers ────────────────────────────────────────────────
  const t0      = Date.now();
  const rawScreens = new Array(CATEGORIES.length); // Uint8Array per cat (poolCount × 8 bytes)
  const rawWins    = new Array(CATEGORIES.length); // Uint32Array per cat (poolCount wins)
  const lastPct    = new Array(CATEGORIES.length).fill(-1);

  await new Promise((resolve, reject) => {
    let doneCount = 0;
    CATEGORIES.forEach((cat, i) => {
      const worker = new Worker(__filename, {
        workerData: {
          catIndex:  i,
          count:     poolCounts[i],
          seed:      (Date.now() + i * 0x1337BEEF) >>> 0,
          // For max category: use a tight gen range so all-V grids are preserved
          genMinWin: i === 6 ? MAX_GEN_MIN : cat.minWin,
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
  // (more accurate than pre-sampled avgs)
  const actualNatAvg = [0, 0, 0, 0];
  for (let ci = 1; ci <= 3; ci++) {
    const wins = rawWins[ci];
    if (wins.length > 0) {
      let s = 0;
      for (let k = 0; k < wins.length; k++) s += wins[k];
      actualNatAvg[ci] = s / wins.length;
    }
  }
  const actualNaturalContrib =
    CATEGORIES[1].prob * actualNatAvg[1] +
    CATEGORIES[2].prob * actualNatAvg[2] +
    CATEGORIES[3].prob * actualNatAvg[3];

  const actualConstructiveBudget = targetExpectedWin - actualNaturalContrib;

  // Recompute target avgs for constructive categories with actual natural data
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

  console.log(`  Actual natural avgs — small:${actualNatAvg[1].toFixed(1)}  medium:${actualNatAvg[2].toFixed(1)}  big:${actualNatAvg[3].toFixed(1)}`);
  console.log(`  Actual natural contrib: ${(actualNaturalContrib / NUM_LINES * 100).toFixed(2)}%`);
  console.log(`  Revised constructive targets: huge=${actualTargetAvgs[0].toFixed(0)} epic=${actualTargetAvgs[1].toFixed(0)} max=${actualTargetAvgs[2].toFixed(0)}\n`);

  // ── Step 5: Sub-sample constructive pools to hit targetAvg ───────────────
  /**
   * Deterministic selection: sort pool by win, use prefix sums to find the
   * exact split (nLow from bottom, nHigh from top) that minimises |avg − target|.
   * O(N log N) sort + O(targetCount) linear scan.  No random sampling → reproducible.
   */
  function selectFromPool(poolScreens, poolWins, targetAvg, targetCount) {
    const N = poolWins.length;

    // Sort pool indices by win ascending
    const sorted = Array.from({ length: N }, (_, i) => i)
      .sort((a, b) => poolWins[a] - poolWins[b]);

    // Prefix sums of sorted wins
    const prefix = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) prefix[i + 1] = prefix[i] + poolWins[sorted[i]];

    // Find s (screens taken from bottom) minimising |avg − targetAvg|
    // Total selected = s (lowest wins) + (targetCount-s) (highest wins)
    const targetSum = targetAvg * targetCount;
    let bestS = 0, bestErr = Infinity;
    for (let s = 0; s <= targetCount; s++) {
      const nHigh = targetCount - s;
      if (nHigh > N - s) continue; // pools overlap — skip
      const sumBottom = prefix[s];
      const sumTop    = prefix[N] - prefix[N - nHigh];
      const err = Math.abs(sumBottom + sumTop - targetSum);
      if (err < bestErr) { bestErr = err; bestS = s; }
    }

    const nLow  = bestS;
    const nHigh = targetCount - nLow;

    const selectedIdx = [
      ...sorted.slice(0, nLow),           // lowest nLow screens
      ...sorted.slice(N - nHigh),         // highest nHigh screens
    ];

    const out     = new Uint8Array(targetCount * SCREEN_BYTES);
    const outWins = [];
    for (let j = 0; j < selectedIdx.length; j++) {
      const srcIdx = selectedIdx[j];
      out.set(poolScreens.subarray(srcIdx * SCREEN_BYTES, srcIdx * SCREEN_BYTES + SCREEN_BYTES), j * SCREEN_BYTES);
      outWins.push(poolWins[srcIdx]);
    }

    const actualAvg = outWins.reduce((s, w) => s + w, 0) / outWins.length;
    const avgLow  = nLow  > 0 ? outWins.slice(0, nLow).reduce((s, w) => s + w, 0) / nLow  : 0;
    const avgHigh = nHigh > 0 ? outWins.slice(nLow).reduce((s, w) => s + w, 0)    / nHigh : 0;
    return { out, actualAvg, avgLow, avgHigh, nLow, nHigh };
  }

  // Apply sub-sampling for constructive categories
  const finalScreens = new Array(CATEGORIES.length);

  console.log('Sub-sampling constructive pools:');
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    if (!cat.constructive) {
      finalScreens[i] = rawScreens[i]; // natural categories: use as-is
    } else {
      const j = i - 4;
      const { out, actualAvg, avgLow, avgHigh, nLow, nHigh } =
        selectFromPool(rawScreens[i], rawWins[i], actualTargetAvgs[j], counts[i]);
      finalScreens[i] = out;
      console.log(`  ${cat.name.padEnd(8)} target=${actualTargetAvgs[j].toFixed(0).padStart(6)}  actual=${actualAvg.toFixed(0).padStart(6)}  (${nLow} low≈${avgLow.toFixed(0)} + ${nHigh} high≈${avgHigh.toFixed(0)})`);
    }
  }
  console.log('');

  // ── Step 6: Write binary file ─────────────────────────────────────────────
  const HEADER_SIZE = 4 + 1 + 1 + CATEGORIES.length * 4; // 34 bytes
  const file = Buffer.alloc(HEADER_SIZE + TOTAL_SCREENS * SCREEN_BYTES, 0);
  file.write('SLOT', 0, 'ascii');
  file[4] = 1;
  file[5] = CATEGORIES.length;

  let off = 6;
  for (const n of counts) { file.writeUInt32LE(n, off); off += 4; }
  for (const r of finalScreens) { file.set(r, off); off += r.length; }

  const outPath = resolve(publicDir, 'screens.bin');
  writeFileSync(outPath, file);
  console.log(`Wrote ${(file.length / 1024).toFixed(1)} KB  →  ${outPath}`);

  // ── Step 6b: Exact theoretical RTP (no sampling noise) ──────────────────
  {
    let exactExpWin = 0;
    console.log('Exact table RTP (per category):');
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const wins = rawWins[i]; // actual wins from generated screens (pool for constructive, full for natural)
      // For constructive, we need avg over the SELECTED screens (finalScreens), not pool
      let avgWin;
      if (cat.constructive) {
        // Recompute avg from finalScreens[i]
        let s = 0, n = counts[i];
        for (let k = 0; k < n; k++) {
          const g = unpackGrid(finalScreens[i], k * SCREEN_BYTES);
          s += evaluateTotalWin(g);
        }
        avgWin = n > 0 ? s / n : 0;
      } else {
        avgWin = wins.length > 0 ? Array.from(wins).reduce((a, b) => a + b, 0) / wins.length : 0;
      }
      const contrib = cat.prob * avgWin / NUM_LINES * 100;
      exactExpWin  += cat.prob * avgWin / NUM_LINES;
      if (i > 0) console.log(`  ${cat.name.padEnd(8)} avg=${avgWin.toFixed(1).padStart(8)}  contrib=${contrib.toFixed(4)}%`);
    }
    console.log(`\n  Exact table RTP: ${(exactExpWin * 100).toFixed(4)}%  (target: ${(TARGET_RTP * 100).toFixed(2)}%)\n`);
  }

  // ── Step 7: Verification — 1 000 000 spins ───────────────────────────────
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║       Verification — 1 000 000 spins       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const flatScreens = new Uint8Array(TOTAL_SCREENS * SCREEN_BYTES);
  let flatOff = 0;
  for (const r of finalScreens) { flatScreens.set(r, flatOff); flatOff += r.length; }

  const catStart = [];
  let sc = 0;
  for (const n of counts) { catStart.push(sc); sc += n; }

  const cumProbs = CATEGORIES.reduce((acc, c) => {
    acc.push((acc.at(-1) ?? 0) + c.prob);
    return acc;
  }, []);

  const SIM = 1_000_000;
  const catHits    = new Array(CATEGORIES.length).fill(0);
  const catWinSums = new Array(CATEGORIES.length).fill(0);

  process.stdout.write('Simulating...');
  const simT0 = Date.now();

  for (let i = 0; i < SIM; i++) {
    const r = Math.random();
    let ci = 0;
    while (ci < cumProbs.length - 1 && r >= cumProbs[ci]) ci++;

    const idx  = catStart[ci] + ((Math.random() * counts[ci]) | 0);
    const grid = unpackGrid(flatScreens, idx * SCREEN_BYTES);
    const win  = evaluateTotalWin(grid);
    catHits[ci]++;
    catWinSums[ci] += win;
  }

  const simMs = Date.now() - simT0;
  process.stdout.write(`\r${' '.repeat(20)}\r`);
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
    const row = [
      c.name,
      target.toFixed(4) + '%',
      actual.toFixed(4) + '%',
      (delta >= 0 ? '+' : '') + delta.toFixed(4) + '%',
      avgWin,
      rtpContrib,
    ];
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
